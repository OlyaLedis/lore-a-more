// A reader's own saved stories, Recently Played, and Places You've Been. Every function here reads
// or writes only the signed-in user's rows; nobody else's history is reachable.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { atPlaceKm, distanceKm, isValidLatLng, type LatLng } from "./geo";
import { publishedStories, toCards } from "./storyCards";
import { requireUser } from "./users";

const LIST_SIZE = 30;

// The reader's current position, sent only with an action they took (opening or saving a story).
// Used to decide whether they're at the story's place, then discarded.
const here = v.optional(v.object({ lat: v.number(), lng: v.number() }));

function isAt(story: Doc<"stories">, position: LatLng | undefined) {
  if (!position || !story.location || !isValidLatLng(position)) return false;
  return distanceKm(position, story.location) <= atPlaceKm(story.location.precision);
}

async function publishedStory(ctx: MutationCtx, storyId: Id<"stories">) {
  const story = await ctx.db.get(storyId);
  if (!story || story.status !== "approved") throw new ConvexError("Story not found.");
  return story;
}

async function recordVisit(
  ctx: MutationCtx,
  userId: Id<"users">,
  storyId: Id<"stories">,
  how: Doc<"placeVisits">["how"],
) {
  const existing = await ctx.db
    .query("placeVisits")
    .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { visitedAt: Date.now() });
  } else {
    await ctx.db.insert("placeVisits", { userId, storyId, how, visitedAt: Date.now() });
  }
}

// Called when a reader opens a published story. Signed-out readers have no history, so it does nothing.
export const recordView = mutation({
  args: { storyId: v.id("stories"), here },
  handler: async (ctx, { storyId, here: position }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const story = await ctx.db.get(storyId);
    if (!story || story.status !== "approved") return null;

    const existing = await ctx.db
      .query("storyViews")
      .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { viewedAt: Date.now() });
    } else {
      await ctx.db.insert("storyViews", { userId, storyId, viewedAt: Date.now() });
    }
    if (isAt(story, position)) await recordVisit(ctx, userId, storyId, "opened_here");
    return null;
  },
});

export const setSaved = mutation({
  args: { storyId: v.id("stories"), saved: v.boolean(), here },
  handler: async (ctx, { storyId, saved, here: position }) => {
    const user = await requireUser(ctx);
    const story = await publishedStory(ctx, storyId);
    const existing = await ctx.db
      .query("savedStories")
      .withIndex("by_userId_and_storyId", (q) => q.eq("userId", user._id).eq("storyId", storyId))
      .unique();
    if (saved && !existing) {
      await ctx.db.insert("savedStories", { userId: user._id, storyId, savedAt: Date.now() });
      if (isAt(story, position)) await recordVisit(ctx, user._id, storyId, "saved_here");
    } else if (!saved && existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// "Mark as visited": the reader says they've been to this story's place.
export const setVisited = mutation({
  args: { storyId: v.id("stories"), visited: v.boolean() },
  handler: async (ctx, { storyId, visited }) => {
    const user = await requireUser(ctx);
    const story = await publishedStory(ctx, storyId);
    if (!story.location) throw new ConvexError("This story isn't connected to a place.");
    if (visited) {
      await recordVisit(ctx, user._id, storyId, "marked");
      return;
    }
    const existing = await ctx.db
      .query("placeVisits")
      .withIndex("by_userId_and_storyId", (q) => q.eq("userId", user._id).eq("storyId", storyId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// Whether the signed-in reader saved this story or has been to its place. Null when signed out.
export const storyState = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [saved, visit] = await Promise.all([
      ctx.db
        .query("savedStories")
        .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
        .unique(),
      ctx.db
        .query("placeVisits")
        .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
        .unique(),
    ]);
    return { saved: saved !== null, visited: visit?.how ?? null };
  },
});

export const saved = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("savedStories")
      .withIndex("by_userId_and_savedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_SIZE);
    return await toCards(ctx, await publishedStories(ctx, rows.map((r) => r.storyId)));
  },
});

// Recently Played: stories the reader opened, most recent first.
export const recentlyPlayed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("storyViews")
      .withIndex("by_userId_and_viewedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_SIZE);
    return await toCards(ctx, await publishedStories(ctx, rows.map((r) => r.storyId)));
  },
});

// Places You've Been: stories whose place the reader marked as visited, or opened or saved while there.
export const placesVisited = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("placeVisits")
      .withIndex("by_userId_and_visitedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_SIZE);
    return await toCards(ctx, await publishedStories(ctx, rows.map((r) => r.storyId)));
  },
});

const MAX_ANCHOR = 80;

// Where the signed-in reader stopped in reading mode, or null.
export const readingPosition = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("readingPositions")
      .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
      .unique();
    return row?.anchor ?? null;
  },
});

// Remembers where the reader stopped. Signed-out readers keep it in their browser instead.
export const saveReadingPosition = mutation({
  args: { storyId: v.id("stories"), anchor: v.string() },
  handler: async (ctx, { storyId, anchor }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || anchor.length > MAX_ANCHOR) return null;
    const story = await ctx.db.get(storyId);
    if (!story || story.status !== "approved") return null;
    const existing = await ctx.db
      .query("readingPositions")
      .withIndex("by_userId_and_storyId", (q) => q.eq("userId", userId).eq("storyId", storyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { anchor, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("readingPositions", { userId, storyId, anchor, updatedAt: Date.now() });
    }
    return null;
  },
});
