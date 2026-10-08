// The curated place-bound legends (src/data/europeanLegends.ts) as real, published StoryPlace stories,
// so each has a page, a permanent code, and appears in search, Home, and the map like any other story.
//
//   node scripts/import-legends.ts            # into your dev deployment
//   node scripts/import-legends.ts --prod     # into production
//
// Importing again updates the same stories (matched by `importId`), keeping their codes, so links
// already shared keep working. The text and source are run through the same checks as a story an
// author writes.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { cleanStoryInput, storyInputObject } from "./stories";
import { newStoryCode } from "./storyCodes";

// The byline on imported legends: the short retellings are ours; the source note names the original.
const BYLINE = "StoryPlace";

const legend = v.object({
  importId: v.string(),
  story: storyInputObject,
});

// The account that owns imported legends. It has no sign-in (no email or password), so nobody can
// sign in as it; it's found through the legends it already owns.
async function legendsAccount(ctx: MutationCtx): Promise<Id<"users">> {
  const any = await ctx.db
    .query("stories")
    .withIndex("by_importId", (q) => q.gt("importId", ""))
    .first();
  return any?.authorId ?? (await ctx.db.insert("users", { name: BYLINE }));
}

export const importLegends = internalMutation({
  args: { legends: v.array(legend) },
  returns: v.object({ added: v.number(), updated: v.number() }),
  handler: async (ctx, { legends }) => {
    const authorId = await legendsAccount(ctx);
    let added = 0;
    let updated = 0;
    for (const { importId, story } of legends) {
      const content = await cleanStoryInput(
        ctx,
        { ...story, author: BYLINE },
        { userId: authorId, storyFiles: new Set() },
      );
      const existing = await ctx.db
        .query("stories")
        .withIndex("by_importId", (q) => q.eq("importId", importId))
        .unique();
      if (existing) {
        await ctx.db.patch("stories", existing._id, content);
        updated++;
      } else {
        await ctx.db.insert("stories", {
          ...content,
          importId,
          authorId,
          status: "approved",
          approvedAt: Date.now(),
          code: await newStoryCode(ctx),
        });
        added++;
      }
    }
    return { added, updated };
  },
});

// Every published story with a place, for exporting to Felt (scripts/felt-export.ts).
export const forExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_status_and_lat", (q) => q.eq("status", "approved").gte("location.lat", -90))
      .take(5000);
    return stories.map((s) => ({
      _id: s._id,
      code: s.code,
      importId: s.importId,
      title: s.title,
      body: s.body,
      category: s.category,
      ageRange: s.ageRange,
      themes: s.themes ?? [],
      location: s.location!,
      source: s.source,
    }));
  },
});
