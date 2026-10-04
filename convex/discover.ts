import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { distanceKm, isValidLatLng, NEARBY_KM, type LatLng } from "./geo";
import { publishedStories, toCard, toCards } from "./storyCards";
import {
  ageRange,
  categoryLabel,
  CATEGORIES,
  storyCategory,
  storyTheme,
  suitableFor,
  themeLabel,
  type AgeRange,
} from "./taxonomy";
import { requireAdmin } from "./users";

const SHELF_SIZE = 12;
const CANDIDATES = 200;
const TOP_PICKS = 8;
const SEARCH_RESULTS = 50;
// Searching around a chosen place: a village gets the default radius, a region a wider one.
const MAX_RADIUS_KM = 300;
const KM_PER_DEG_LAT = 111;
const PLACE_SUGGESTIONS = 5;
const MAX_NEARBY = 100;

const latLng = v.object({ lat: v.number(), lng: v.number() });

// Published stories within `radiusKm` of `here`, nearest first.
async function nearbyStories(ctx: QueryCtx, here: LatLng, radiusKm = NEARBY_KM) {
  if (!isValidLatLng(here)) return [];
  const radius = Math.min(Math.max(radiusKm, 1), MAX_RADIUS_KM);
  // The latitude band that contains the circle, with a little margin.
  const band = radius / KM_PER_DEG_LAT + 0.05;
  const inBand = await ctx.db
    .query("stories")
    .withIndex("by_status_and_lat", (q) =>
      q
        .eq("status", "approved")
        .gte("location.lat", here.lat - band)
        .lte("location.lat", here.lat + band),
    )
    .take(CANDIDATES);
  return inBand
    .map((story) => ({ story, km: distanceKm(here, story.location!) }))
    .filter(({ km }) => km <= radius)
    .sort((a, b) => a.km - b.km);
}

// Place names authors saved on published stories that match what the reader typed, so places
// MapTiler doesn't know (like "Su Sterru, Golgo Plateau") can still be found. One entry per place
// name, with how many stories are there.
export const placeSuggestions = query({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const terms = text.trim();
    if (terms.length < 2) return [];
    const words = terms
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((w) => w.length >= 2);
    const matches = await ctx.db
      .query("stories")
      .withSearchIndex("search_text", (q) => q.search("searchText", terms).eq("status", "approved"))
      .take(CANDIDATES);

    const byPlace = new Map<string, { place: string; lat: number; lng: number; storyCount: number }>();
    for (const story of matches) {
      const place = story.location?.place;
      if (!place) continue;
      // The search also matches titles and themes; only suggest stories whose place name matches.
      const name = place.toLowerCase();
      if (!words.some((w) => name.includes(w))) continue;
      const entry = byPlace.get(name);
      if (entry) entry.storyCount++;
      else byPlace.set(name, { place, lat: story.location!.lat, lng: story.location!.lng, storyCount: 1 });
    }
    return [...byPlace.values()].slice(0, PLACE_SUGGESTIONS);
  },
});

// Public sections of Home: the Seasonal collection and the newest stories in each category.
// Empty sections are left out.
export const home = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("collectionEntries")
      .withIndex("by_collection_and_addedAt", (q) => q.eq("collection", "seasonal"))
      .order("desc")
      .take(SHELF_SIZE);
    const seasonal = await toCards(ctx, await publishedStories(ctx, entries.map((e) => e.storyId)));

    const categories = await Promise.all(
      CATEGORIES.map(async ({ value, label }) => ({
        category: value,
        label,
        stories: await toCards(
          ctx,
          await ctx.db
            .query("stories")
            .withIndex("by_status_and_category_and_approvedAt", (q) =>
              q.eq("status", "approved").eq("category", value),
            )
            .order("desc")
            .take(SHELF_SIZE),
        ),
      })),
    );

    return { seasonal, categories: categories.filter((c) => c.stories.length > 0) };
  },
});

// Stories Near You, or near a place the reader searched for. `here` is used only for this query and
// never stored. `radiusKm` defaults to NEARBY_KM and is capped at MAX_RADIUS_KM.
export const nearby = query({
  args: {
    here: latLng,
    radiusKm: v.optional(v.number()),
    // How many to return (default SHELF_SIZE, at most MAX_NEARBY), optionally only one category.
    limit: v.optional(v.number()),
    category: v.optional(storyCategory),
  },
  handler: async (ctx, { here, radiusKm, limit, category }) => {
    const count = Math.min(Math.max(Math.floor(limit ?? SHELF_SIZE), 1), MAX_NEARBY);
    return await Promise.all(
      (await nearbyStories(ctx, here, radiusKm))
        .filter(({ story }) => !category || story.category === category)
        .slice(0, count)
        .map(async ({ story, km }) => ({ ...(await toCard(ctx, story)), distanceKm: Math.round(km * 10) / 10 })),
    );
  },
});

// Top Picks: a few stories chosen by simple rules the reader can understand, each with its reason.
//   - near the reader's current location (only if they shared it),
//   - shares a theme with stories they saved or opened,
//   - same category as stories they saved or opened.
// Stories they already opened or saved are skipped, and if they chose an age range, only stories
// suitable for it are shown. With no signals at all, there are no picks (never random filler).
export const topPicks = query({
  args: { here: v.optional(latLng) },
  handler: async (ctx, { here }) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const readerAge = user?.ageRange;

    const seenIds = new Set<Id<"stories">>();
    if (userId) {
      const [views, saves] = await Promise.all([
        ctx.db
          .query("storyViews")
          .withIndex("by_userId_and_viewedAt", (q) => q.eq("userId", userId))
          .order("desc")
          .take(50),
        ctx.db
          .query("savedStories")
          .withIndex("by_userId_and_savedAt", (q) => q.eq("userId", userId))
          .order("desc")
          .take(50),
      ]);
      for (const row of [...views, ...saves]) seenIds.add(row.storyId);
    }
    const seen = await publishedStories(ctx, [...seenIds]);
    const themeCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    for (const story of seen) {
      for (const theme of story.themes ?? []) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
      if (story.category) categoryCounts.set(story.category, (categoryCounts.get(story.category) ?? 0) + 1);
    }

    const near = here ? await nearbyStories(ctx, here) : [];
    if (near.length === 0 && themeCounts.size === 0 && categoryCounts.size === 0) return [];

    const candidates = new Map<Id<"stories">, Doc<"stories">>();
    for (const { story } of near) candidates.set(story._id, story);
    const recent = await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(CANDIDATES);
    for (const story of recent) candidates.set(story._id, story);
    const nearIds = new Set(near.map(({ story }) => story._id));

    const picks = [];
    for (const story of candidates.values()) {
      if (seenIds.has(story._id)) continue;
      if (readerAge && !(story.ageRange && suitableFor(story.ageRange, readerAge))) continue;

      let score = 0;
      let reason: string | null = null;
      if (nearIds.has(story._id)) {
        score += 3;
        reason = "Near you";
      }
      const sharedThemes = (story.themes ?? [])
        .filter((t) => themeCounts.has(t))
        .sort((a, b) => themeCounts.get(b)! - themeCounts.get(a)!);
      if (sharedThemes.length > 0) {
        score += 2 * sharedThemes.length;
        reason ??= `Because you explored ${themeLabel(sharedThemes[0])}`;
      }
      if (story.category && categoryCounts.has(story.category)) {
        score += 1;
        reason ??= `More ${categoryLabel(story.category)}`;
      }
      if (reason) picks.push({ story, score, reason });
    }

    return await Promise.all(
      picks
        .sort((a, b) => b.score - a.score || (b.story.approvedAt ?? 0) - (a.story.approvedAt ?? 0))
        .slice(0, TOP_PICKS)
        .map(async ({ story, reason }) => ({ ...(await toCard(ctx, story)), reason })),
    );
  },
});

// Search published stories by title, place, category, themes, or pen name, with optional filters.
// The age filter shows stories suitable for that age: "8+" includes stories marked 6+ and 8+.
// Looks at the best CANDIDATES matches (or newest stories when there's no text), so filters on a
// very large catalog can miss older stories.
export const search = query({
  args: {
    text: v.optional(v.string()),
    category: v.optional(storyCategory),
    ageRange: v.optional(ageRange),
    theme: v.optional(storyTheme),
  },
  handler: async (ctx, { text, category, ageRange, theme }) => {
    const terms = text?.trim() ?? "";
    let stories: Doc<"stories">[];
    if (terms) {
      stories = await ctx.db
        .query("stories")
        .withSearchIndex("search_text", (q) => {
          const matching = q.search("searchText", terms).eq("status", "approved");
          return category ? matching.eq("category", category) : matching;
        })
        .take(CANDIDATES);
    } else if (category) {
      stories = await ctx.db
        .query("stories")
        .withIndex("by_status_and_category_and_approvedAt", (q) =>
          q.eq("status", "approved").eq("category", category),
        )
        .order("desc")
        .take(CANDIDATES);
    } else {
      stories = await ctx.db
        .query("stories")
        .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "approved"))
        .order("desc")
        .take(CANDIDATES);
    }
    return await toCards(
      ctx,
      stories
        .filter((s) => !ageRange || (s.ageRange && suitableFor(s.ageRange, ageRange as AgeRange)))
        .filter((s) => !theme || (s.themes ?? []).includes(theme))
        .slice(0, SEARCH_RESULTS),
    );
  },
});

// Whether a story is in Seasonal Stories. Null for anyone but admins.
export const isSeasonal = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user?.isAdmin) return null;
    const entry = await ctx.db
      .query("collectionEntries")
      .withIndex("by_collection_and_storyId", (q) => q.eq("collection", "seasonal").eq("storyId", storyId))
      .unique();
    return entry !== null;
  },
});

// Admins add published stories to Seasonal Stories, or take them out, without editing the story.
export const setSeasonal = mutation({
  args: { storyId: v.id("stories"), featured: v.boolean() },
  handler: async (ctx, { storyId, featured }) => {
    await requireAdmin(ctx);
    const story = await ctx.db.get(storyId);
    if (!story || story.status !== "approved")
      throw new ConvexError("Only published stories can be in Seasonal Stories.");
    const entry = await ctx.db
      .query("collectionEntries")
      .withIndex("by_collection_and_storyId", (q) => q.eq("collection", "seasonal").eq("storyId", storyId))
      .unique();
    if (featured && !entry) {
      await ctx.db.insert("collectionEntries", { collection: "seasonal", storyId, addedAt: Date.now() });
    } else if (!featured && entry) {
      await ctx.db.delete(entry._id);
    }
  },
});
