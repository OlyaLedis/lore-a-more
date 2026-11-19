import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isValidLatLng } from "./geo";
import {
  bodyOf,
  cleanScenes,
  deleteUnusedFiles,
  scenesOf,
  withImageUrls,
} from "./scenes";
import { cardCoverOf, cleanCover, coverWithUrl, filesOf } from "./covers";
import { locationPrecision, scene, storyCover, storyLocation } from "./schema";
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
import { newStoryCode, storyFromLink } from "./storyCodes";
import { requireAdmin, requireUser } from "./users";

const MAX_TITLE = 120;
const MAX_AUTHOR = 60;
const MAX_BODY = 50_000;
const MAX_PLACE = 120;
const MAX_MAP_STORIES = 500;
const MAP_EXCERPT = 280;
const MAX_SOURCE = 300;
const MAX_SOURCE_URL = 500;

// What an author writes, for both new stories and edits. New input must say how precise the
// location is, and must have a category, age range, and source.
const storyInput = {
  title: v.string(),
  // The story in ordered scenes; `body` is derived from them.
  scenes: v.array(scene),
  // The card cover: a picture in a paper frame, or the colorful category cover.
  cover: storyCover,
  author: v.optional(v.string()),
  location: v.optional(v.object({ ...storyLocation.fields, precision: locationPrecision })),
  category: storyCategory,
  ageRange: ageRange,
  themes: v.array(storyTheme),
  source: storySource,
};
export const storyInputObject = v.object(storyInput);

export async function cleanStoryInput(
  ctx: MutationCtx,
  args: Infer<typeof storyInputObject>,
  // Who is writing, and the files this story already uses (empty for a new story).
  owner: { userId: Id<"users">; storyFiles: Set<Id<"_storage">>; placeholderFile?: Id<"_storage"> },
) {
  const title = args.title.trim();
  const scenes = await cleanScenes(ctx, args.scenes);
  const cover = await cleanCover(ctx, args.cover, { scenes, ...owner });
  const body = bodyOf(scenes);
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
  const url = args.source.url?.trim() || undefined;
  if (url && (url.length > MAX_SOURCE_URL || !isWebLink(url)))
    throw new ConvexError("The source link must be a web address starting with https:// or http://.");
  const source = { kind: args.source.kind, detail, url };

  const content = {
    title,
    body,
    scenes,
    cover,
    author,
    location,
    category: args.category,
    ageRange: args.ageRange,
    themes,
    source,
  };
  return { ...content, searchText: searchTextFor(content) };
}

// Only http(s) links, so a source link can never run script when clicked.
function isWebLink(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

type Searchable = Pick<Doc<"stories">, "title" | "author" | "location" | "category" | "themes">;

// What story search matches against: title, place, category, themes, and pen name.
export function searchTextFor({ title, author, location, category, themes }: Searchable) {
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
  table: Extract<
    TableNames,
    | "savedStories"
    | "storyViews"
    | "placeVisits"
    | "collectionEntries"
    | "readingPositions"
    | "characterStories"
    | "storyIllustrators"
  >,
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
    const result = await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (story) => ({ ...story, cover: await cardCoverOf(ctx, story) })),
    );
    return { ...result, page };
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
    return await Promise.all(
      stories.flatMap((story) => {
        const { _id, code, title, author, location, category, ageRange, themes } = story;
        if (!location) return [];
        // The opening of the story, for the map popup and map search.
        const excerpt = story.body.length > MAP_EXCERPT ? `${story.body.slice(0, MAP_EXCERPT).trimEnd()}…` : story.body;
        return [
          cardCoverOf(ctx, story).then((cover) => ({
            _id,
            code,
            title,
            author,
            location,
            category,
            ageRange,
            themes,
            excerpt,
            cover,
          })),
        ];
      }),
    );
  },
});

// Approved stories are public. Unapproved ones are visible only to their author and admins.
// Always the published version; pending edits are only visible through `editable` and the review queue.
export const get = query({
  // The story's code (from a link) or, for older links, its database id.
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const story = await storyFromLink(ctx, id);
    if (!story) return null;
    // Scenes are always present here: stories from before scenes come back as one scene.
    const withScenes = async () => ({ ...story, scenes: await withImageUrls(ctx, scenesOf(story)) });
    if (story.status === "approved") return await withScenes();

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (story.authorId === userId) return await withScenes();
    const user = await ctx.db.get(userId);
    return user?.isAdmin ? await withScenes() : null;
  },
});

// The author's latest version of their story, for the edit form and their status notes: the pending
// or rejected edit if there is one, otherwise the story itself. Null for anyone but the author.
export const editable = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const story = await storyFromLink(ctx, id);
    if (!userId || !story || story.authorId !== userId) return null;

    const revision = await revisionFor(ctx, story._id);
    const latest = revision ?? story;
    return {
      _id: story._id,
      code: story.code,
      status: story.status,
      revisionStatus: revision?.status ?? null,
      title: latest.title,
      scenes: await withImageUrls(ctx, scenesOf(latest)),
      // Null for stories that never chose a cover.
      cover: await coverWithUrl(ctx, latest.cover),
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
      ...(await cleanStoryInput(ctx, args, { userId: user._id, storyFiles: new Set() })),
      authorId: user._id,
      status: "pending",
      code: await newStoryCode(ctx),
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
    const existing = await revisionFor(ctx, id);
    const content = await cleanStoryInput(ctx, input, {
      userId: story.authorId,
      storyFiles: new Set([...filesOf(story), ...filesOf(existing)]),
      placeholderFile: story.cover?.kind === "image" && story.cover.placeholder ? story.cover.storageId : undefined,
    });
    const newFiles = filesOf(content);

    if (story.status !== "approved") {
      await ctx.db.patch(id, { ...content, status: "pending", approvedAt: undefined });
      await deleteUnusedFiles(ctx, filesOf(story), newFiles);
      return;
    }

    const { searchText: _, ...revisionContent } = content;
    const revision = { ...revisionContent, status: "pending" as const, submittedAt: Date.now() };
    if (existing) {
      await ctx.db.replace(existing._id, { storyId: id, authorId: story.authorId, ...revision });
      // Pictures dropped from the waiting edit, unless the published version still shows them.
      await deleteUnusedFiles(ctx, filesOf(existing), newFiles, filesOf(story));
    } else {
      await ctx.db.insert("storyRevisions", { storyId: id, authorId: story.authorId, ...revision });
    }
  },
});

// Authors upload illustrations here, then pass the storage id with the story's scenes.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Author deletes their story, along with any edit waiting for review, readers' saves and history,
// collection entries, and character links.
export const remove = mutation({
  args: { id: v.id("stories") },
  handler: async (ctx, { id }) => {
    const story = await requireOwnStory(ctx, id);
    const revision = await revisionFor(ctx, id);
    if (revision) await ctx.db.delete(revision._id);
    await deleteByStory(ctx, "readingPositions", id);
    await deleteByStory(ctx, "savedStories", id);
    await deleteByStory(ctx, "storyViews", id);
    await deleteByStory(ctx, "placeVisits", id);
    await deleteByStory(ctx, "collectionEntries", id);
    await deleteByStory(ctx, "characterStories", id);
    await deleteByStory(ctx, "storyIllustrators", id);
    await ctx.db.delete(id);
    // Once the story is gone, so a placeholder tile it shared with other stories is kept for them only.
    await deleteUnusedFiles(ctx, new Set([...filesOf(story), ...filesOf(revision)]));
  },
});

// Review queue for admins: oldest submissions first.
export const pending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "pending"))
      .paginate(paginationOpts);
    // Moderators see the pictures they're approving.
    const page = await Promise.all(
      result.page.map(async (story) => ({
        ...story,
        scenes: await withImageUrls(ctx, scenesOf(story)),
        cardCover: await cardCoverOf(ctx, story),
      })),
    );
    return { ...result, page };
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
        scenes: await withImageUrls(ctx, scenesOf(revision)),
        cardCover: await cardCoverOf(ctx, revision),
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
    const story = await ctx.db.get(revision.storyId);
    const { title, body, scenes, cover, author, location, category, ageRange, themes, source } = revision;
    const content = { title, body, scenes, cover, author, location, category, ageRange, themes, source };
    await ctx.db.patch(revision.storyId, {
      ...content,
      searchText: searchTextFor(content),
      editedAt: Date.now(),
    });
    await ctx.db.delete(id);
    // Pictures the approved edit no longer uses.
    await deleteUnusedFiles(ctx, filesOf(story), filesOf(revision));
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

// Fixes a story's place, type, or topics by its code, without the review step: for corrections an
// admin asks for from the command line, such as a test story pinned in the wrong country.
//   npx convex run stories:fixDetails '{"code":"SP-8S8AEM","category":"wonder_tale"}'
// Only the fields given change. A pending revision of the story is left alone.
export const fixDetails = internalMutation({
  args: {
    code: v.string(),
    location: v.optional(storyLocation),
    category: v.optional(storyCategory),
    themes: v.optional(v.array(storyTheme)),
  },
  returns: v.null(),
  handler: async (ctx, { code, location, category, themes }) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!story) throw new ConvexError(`No story ${code}.`);
    if (location && !isValidLatLng(location)) throw new ConvexError("That position isn't on the map.");
    if (themes && themes.length > MAX_THEMES) throw new ConvexError(`At most ${MAX_THEMES} topics.`);
    const changes = {
      ...(location && { location }),
      ...(category && { category }),
      ...(themes && { themes }),
    };
    await ctx.db.patch("stories", story._id, { ...changes, searchText: searchTextFor({ ...story, ...changes }) });
    return null;
  },
});
