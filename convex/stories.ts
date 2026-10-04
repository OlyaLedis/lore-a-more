import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isValidLatLng } from "./geo";
import { locationPrecision, storyLocation } from "./schema";
import {
  ageRange,
  categoryLabel,
  MAX_THEMES,
  storyCategory,
  storySource,
  storyTheme,
  themeLabel,
} from "./taxonomy";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./users";

const MAX_TITLE = 120;
const MAX_AUTHOR = 60;
const MAX_BODY = 50_000;
const MAX_PLACE = 120;
const MAX_MAP_STORIES = 500;
const MAX_SOURCE = 300;

// What an author writes, for both new stories and edits. New input must say how precise the
// location is, and must have a category, age range, and source.
const storyInput = {
  title: v.string(),
  body: v.string(),
  author: v.optional(v.string()),
  location: v.optional(v.object({ ...storyLocation.fields, precision: locationPrecision })),
  category: storyCategory,
  ageRange: ageRange,
  themes: v.array(storyTheme),
  source: storySource,
};
const storyInputObject = v.object(storyInput);

function cleanStoryInput(args: Infer<typeof storyInputObject>) {
  const title = args.title.trim();
  const body = args.body.trim();
  const author = args.author?.trim() || undefined;

  if (!title) throw new ConvexError("Title is required.");
  if (!body) throw new ConvexError("Story can't be empty.");
  if (title.length > MAX_TITLE)
    throw new ConvexError(`Title must be ${MAX_TITLE} characters or fewer.`);
  if (body.length > MAX_BODY)
    throw new ConvexError(`Story must be ${MAX_BODY.toLocaleString()} characters or fewer.`);
  if (author && author.length > MAX_AUTHOR)
    throw new ConvexError(`Pen name must be ${MAX_AUTHOR} characters or fewer.`);

  let location = undefined;
  if (args.location) {
    const { lat, lng, precision } = args.location;
    const place = args.location.place?.trim() || undefined;
    if (!isValidLatLng({ lat, lng }))
      throw new ConvexError("That location isn't valid.");
    if (place && place.length > MAX_PLACE)
      throw new ConvexError(`Place name must be ${MAX_PLACE} characters or fewer.`);
    location = { lat, lng, place, precision };
  }

  const themes = [...new Set(args.themes)];
  if (themes.length > MAX_THEMES) throw new ConvexError(`Choose up to ${MAX_THEMES} themes.`);

  const detail = args.source.detail?.trim() || undefined;
  if (args.source.kind === "reference" && !detail)
    throw new ConvexError("Name the source the story is based on.");
  if (detail && detail.length > MAX_SOURCE)
    throw new ConvexError(`Source must be ${MAX_SOURCE} characters or fewer.`);
  const source = { kind: args.source.kind, detail };

  const content = { title, body, author, location, category: args.category, ageRange: args.ageRange, themes, source };
  return { ...content, searchText: searchTextFor(content) };
}

type Searchable = Pick<Doc<"stories">, "title" | "author" | "location" | "category" | "themes">;

// What story search matches against: title, place, category, themes, and pen name.
function searchTextFor({ title, author, location, category, themes }: Searchable) {
  return [
    title,
    location?.place,
    category && categoryLabel(category),
    ...(themes ?? []).map(themeLabel),
    author,
  ]
    .filter(Boolean)
    .join(" ");
}

// Removes a deleted story's rows from a per-story table.
async function deleteByStory(
  ctx: MutationCtx,
  table: Extract<TableNames, "savedStories" | "storyViews" | "placeVisits" | "collectionEntries">,
  storyId: Id<"stories">,
) {
  for await (const row of ctx.db.query(table).withIndex("by_storyId", (q) => q.eq("storyId", storyId))) {
    await ctx.db.delete(row._id);
  }
}

async function revisionFor(ctx: QueryCtx, storyId: Id<"stories">) {
  return await ctx.db
    .query("storyRevisions")
    .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
    .unique();
}

// The signed-in user's own story. Someone else's story looks the same as a missing one.
async function requireOwnStory(ctx: MutationCtx, id: Id<"stories">) {
  const user = await requireUser(ctx);
  const story = await ctx.db.get(id);
  if (!story || story.authorId !== user._id) throw new ConvexError("Story not found.");
  return story;
}

// Public feed: approved stories only, most recently published first.
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .paginate(paginationOpts);
  },
});

// Approved stories that have a location, for the map. Returns only what a marker popup needs.
export const mapped = query({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_status_and_lat", (q) =>
        q.eq("status", "approved").gte("location.lat", -90),
      )
      .take(MAX_MAP_STORIES);
    return stories.flatMap(({ _id, title, author, location }) =>
      location ? [{ _id, title, author, location }] : [],
    );
  },
});

// Approved stories are public. Unapproved ones are visible only to their author and admins.
// Always the published version; pending edits are only visible through `editable` and the review queue.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const storyId = ctx.db.normalizeId("stories", id);
    const story = storyId ? await ctx.db.get(storyId) : null;
    if (!story) return null;
    if (story.status === "approved") return story;

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (story.authorId === userId) return story;
    const user = await ctx.db.get(userId);
    return user?.isAdmin ? story : null;
  },
});

// The author's latest version of their story, for the edit form and their status notes: the pending
// or rejected edit if there is one, otherwise the story itself. Null for anyone but the author.
export const editable = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const storyId = ctx.db.normalizeId("stories", id);
    const story = storyId ? await ctx.db.get(storyId) : null;
    if (!userId || !story || story.authorId !== userId) return null;

    const revision = await revisionFor(ctx, story._id);
    const latest = revision ?? story;
    return {
      _id: story._id,
      status: story.status,
      revisionStatus: revision?.status ?? null,
      title: latest.title,
      body: latest.body,
      author: latest.author,
      location: latest.location,
      category: latest.category,
      ageRange: latest.ageRange,
      themes: latest.themes,
      source: latest.source,
    };
  },
});

// The signed-in user's own submissions, in any status, with the status of any edit under review.
export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("stories")
      .withIndex("by_authorId", (q) => q.eq("authorId", userId))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (story) => ({
        ...story,
        revisionStatus: (await revisionFor(ctx, story._id))?.status ?? null,
      })),
    );
    return { ...result, page };
  },
});

export const submit = mutation({
  args: storyInput,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("stories", {
      ...cleanStoryInput(args),
      authorId: user._id,
      status: "pending",
    });
  },
});

// Author edits their story. A published story stays as it is for readers while the edit waits
// for review; editing again replaces the waiting edit. A story that was never published is
// changed directly and goes back to the review queue.
export const update = mutation({
  args: { id: v.id("stories"), ...storyInput },
  handler: async (ctx, { id, ...input }) => {
    const story = await requireOwnStory(ctx, id);
    const content = cleanStoryInput(input);

    if (story.status !== "approved") {
      await ctx.db.patch(id, { ...content, status: "pending", approvedAt: undefined });
      return;
    }

    const { searchText: _, ...revisionContent } = content;
    const revision = { ...revisionContent, status: "pending" as const, submittedAt: Date.now() };
    const existing = await revisionFor(ctx, id);
    if (existing) {
      await ctx.db.replace(existing._id, { storyId: id, authorId: story.authorId, ...revision });
    } else {
      await ctx.db.insert("storyRevisions", { storyId: id, authorId: story.authorId, ...revision });
    }
  },
});

// Author deletes their story, along with any edit waiting for review, readers' saves and history,
// and collection entries.
export const remove = mutation({
  args: { id: v.id("stories") },
  handler: async (ctx, { id }) => {
    await requireOwnStory(ctx, id);
    const revision = await revisionFor(ctx, id);
    if (revision) await ctx.db.delete(revision._id);
    await deleteByStory(ctx, "savedStories", id);
    await deleteByStory(ctx, "storyViews", id);
    await deleteByStory(ctx, "placeVisits", id);
    await deleteByStory(ctx, "collectionEntries", id);
    await ctx.db.delete(id);
  },
});

// Review queue for admins: oldest submissions first.
export const pending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "pending"))
      .paginate(paginationOpts);
  },
});

export const review = mutation({
  args: {
    id: v.id("stories"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, { id, decision }) => {
    await requireAdmin(ctx);
    const story = await ctx.db.get(id);
    if (!story) throw new ConvexError("Story not found.");
    await ctx.db.patch(id, {
      status: decision,
      approvedAt: decision === "approved" ? Date.now() : undefined,
    });
  },
});

// Edits to published stories waiting for review, oldest first, with the title readers see now.
export const pendingRevisions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("storyRevisions")
      .withIndex("by_status_and_submittedAt", (q) => q.eq("status", "pending"))
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (revision) => ({
        ...revision,
        publishedTitle: (await ctx.db.get(revision.storyId))?.title ?? null,
      })),
    );
    return { ...result, page };
  },
});

// Approving an edit replaces the published version with it. Rejecting keeps the published version
// and leaves the edit marked rejected so the author can see it and try again.
export const reviewRevision = mutation({
  args: {
    id: v.id("storyRevisions"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, { id, decision }) => {
    await requireAdmin(ctx);
    const revision = await ctx.db.get(id);
    if (!revision || revision.status !== "pending")
      throw new ConvexError("This edit was withdrawn or already reviewed.");

    if (decision === "rejected") {
      await ctx.db.patch(id, { status: "rejected" });
      return;
    }
    const { title, body, author, location, category, ageRange, themes, source } = revision;
    const content = { title, body, author, location, category, ageRange, themes, source };
    await ctx.db.patch(revision.storyId, {
      ...content,
      searchText: searchTextFor(content),
      editedAt: Date.now(),
    });
    await ctx.db.delete(id);
  },
});

// One-off, after deploying search: fills `searchText` for stories written before it existed.
//   npx convex run stories:backfillSearchText
// Runs in batches and schedules itself until every story is done.
export const backfillSearchText = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("stories")
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    let updated = 0;
    for (const story of page) {
      const searchText = searchTextFor(story);
      if (story.searchText !== searchText) {
        await ctx.db.patch(story._id, { searchText });
        updated++;
      }
    }
    if (!isDone) await ctx.scheduler.runAfter(0, internal.stories.backfillSearchText, { cursor: continueCursor });
    return { updated, isDone };
  },
});
