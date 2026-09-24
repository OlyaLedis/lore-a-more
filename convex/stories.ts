import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./users";

const MAX_TITLE = 120;
const MAX_AUTHOR = 60;
const MAX_BODY = 50_000;

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

// Approved stories are public. Unapproved ones are visible only to their author and admins.
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

// The signed-in user's own submissions, in any status.
export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    return await ctx.db
      .query("stories")
      .withIndex("by_authorId", (q) => q.eq("authorId", userId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const submit = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
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

    return await ctx.db.insert("stories", {
      title,
      body,
      author,
      authorId: user._id,
      status: "pending",
    });
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
