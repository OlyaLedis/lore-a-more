// Character cards: a legendary being as one tradition tells it, shown after the stories it's in, for the
// grown-up telling them. Each card is drafted from source excerpts (Lore-a-More Stories/character-card-prompt.md),
// reviewed by an editor, and loaded with scripts/import-character-cards.ts. Loading again (matched by
// `slug`) updates the card and replaces its story links.
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { ageRange } from "./taxonomy";

const MAX_TEXT = 500;
const MAX_ITEMS = 12;

const card = v.object({
  slug: v.string(),
  name: v.string(),
  localName: v.string(),
  region: v.string(),
  ageRange,
  beliefs: v.array(v.string()),
  plots: v.array(v.string()),
  questions: v.array(v.string()),
  sources: v.array(v.string()),
});

export const importCard = internalMutation({
  // The stories by their curated legends' `importId` (e.g. "legend-93").
  args: { card, storyImportIds: v.array(v.string()) },
  returns: v.object({ added: v.boolean(), stories: v.number() }),
  handler: async (ctx, { card, storyImportIds }) => {
    if (!/^[a-z0-9-]{1,80}$/.test(card.slug)) throw new ConvexError("A card's slug is lowercase letters, digits, and dashes.");
    if (!card.name.trim()) throw new ConvexError("A card needs a name.");
    if (card.sources.length === 0) throw new ConvexError("A card needs at least one source.");
    for (const list of [card.beliefs, card.plots, card.questions, card.sources]) {
      if (list.length > MAX_ITEMS || list.some((text) => !text.trim() || text.length > MAX_TEXT)) {
        throw new ConvexError(`Each list has at most ${MAX_ITEMS} entries of 1 to ${MAX_TEXT} characters.`);
      }
    }
    const storyIds = [];
    for (const importId of storyImportIds) {
      const story = await ctx.db
        .query("stories")
        .withIndex("by_importId", (q) => q.eq("importId", importId))
        .unique();
      if (!story) throw new ConvexError(`No imported legend ${importId}.`);
      storyIds.push(story._id);
    }

    const existing = await ctx.db
      .query("characterCards")
      .withIndex("by_slug", (q) => q.eq("slug", card.slug))
      .unique();
    const characterId = existing?._id ?? (await ctx.db.insert("characterCards", card));
    if (existing) {
      await ctx.db.replace("characterCards", existing._id, card);
      for await (const link of ctx.db
        .query("characterStories")
        .withIndex("by_characterId", (q) => q.eq("characterId", characterId))) {
        await ctx.db.delete(link._id);
      }
    }
    for (const storyId of new Set(storyIds)) await ctx.db.insert("characterStories", { characterId, storyId });
    return { added: !existing, stories: new Set(storyIds).size };
  },
});

// The cards for a story page. Only for published stories, like the story itself.
export const forStory = query({
  args: { storyId: v.id("stories") },
  returns: v.array(
    v.object({
      _id: v.id("characterCards"),
      name: v.string(),
      localName: v.string(),
      region: v.string(),
      beliefs: v.array(v.string()),
      questions: v.array(v.string()),
      sources: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { storyId }) => {
    const story = await ctx.db.get("stories", storyId);
    if (story?.status !== "approved") return [];
    const links = await ctx.db
      .query("characterStories")
      .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
      .take(10);
    const cards = [];
    for (const link of links) {
      const c = await ctx.db.get("characterCards", link.characterId);
      if (c) cards.push({ _id: c._id, name: c.name, localName: c.localName, region: c.region, beliefs: c.beliefs, questions: c.questions, sources: c.sources });
    }
    return cards;
  },
});
