// The curated place-bound legends (src/data/europeanLegends.ts) as real, published StoryPlace stories,
// so each has a page, a permanent code, and appears in search, Home, and the map like any other story.
//
//   node scripts/import-legends.ts            # into your dev deployment
//   node scripts/import-legends.ts --prod     # into production
//
// Importing again updates the same stories (matched by `importId`), keeping their codes, so links
// already shared keep working. The text and source are run through the same checks as a story an
// author writes.
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { cleanStoryInput, storyInputObject } from "./stories";
import { newStoryCode } from "./storyCodes";
import { cleanCover, filesOf } from "./covers";
import { cleanScenes, deleteUnusedFiles, scenesOf } from "./scenes";

// The byline on imported legends: the short retellings are ours; the source note names the original.
const BYLINE = "Loramore";

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
      const existing = await ctx.db
        .query("stories")
        .withIndex("by_importId", (q) => q.eq("importId", importId))
        .unique();
      // The legends file has no pictures. Pictures added later (setPicture) stay with their scene, and the
      // cover stays (one of the scene pictures or a cover of its own), so importing again never wipes them.
      const before = filesOf(existing);
      const kept = existing ? keepPictures(story, existing) : story;
      const content = await cleanStoryInput(
        ctx,
        { ...kept, author: BYLINE },
        {
          userId: authorId,
          storyFiles: before,
          placeholderFile: existing?.cover?.kind === "image" && existing.cover.placeholder ? existing.cover.storageId : undefined,
        },
      );
      if (existing) {
        await ctx.db.patch("stories", existing._id, content);
        await deleteUnusedFiles(ctx, before, filesOf(content));
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

function keepPictures(story: Infer<typeof storyInputObject>, existing: Doc<"stories">) {
  const existingScenes = scenesOf(existing);
  const old = new Map(existingScenes.map((scene) => [scene.id, scene.illustrations]));
  // The legends file holds one short scene. A story already loaded in full (scripts/import-story-folders.ts)
  // keeps its scenes, so importing the file again never puts the summary back.
  const scenes = story.scenes.length === 1 && existingScenes.length > 1
    ? existingScenes
    : story.scenes.map((scene) =>
        scene.illustrations.length === 0 && old.has(scene.id) ? { ...scene, illustrations: old.get(scene.id)! } : scene,
      );
  const cover = story.cover.kind === "colors" && existing.cover?.kind === "image" ? existing.cover : story.cover;
  return { ...story, scenes, cover };
}

// Pictures for legends: upload a file to the URL from pictureUploadUrl, then setPicture makes it the
// legend's cover and the illustration after its last scene (replacing an earlier one), or only one of
// the two (`use`), keeping the other as it is. scripts/legend-pictures.ts does both steps.
export const pictureUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

// Finds the story by its legend number (`importId`) or, for a story written in the app, by its code.
export const setPicture = internalMutation({
  args: {
    importId: v.optional(v.string()),
    code: v.optional(v.string()),
    storageId: v.id("_storage"),
    alt: v.string(),
    credit: v.optional(v.string()),
    use: v.optional(v.union(v.literal("cover"), v.literal("illustration"))),
  },
  returns: v.null(),
  handler: async (ctx, { importId, code, storageId, alt, credit, use }) => {
    if ((importId === undefined) === (code === undefined)) throw new ConvexError("Give an importId or a code.");
    const story =
      importId !== undefined
        ? await ctx.db.query("stories").withIndex("by_importId", (q) => q.eq("importId", importId)).unique()
        : await ctx.db.query("stories").withIndex("by_code", (q) => q.eq("code", code!.toUpperCase())).unique();
    if (!story) throw new ConvexError(`No story ${importId ?? code}.`);
    const before = filesOf(story);
    const scenes = scenesOf(story);
    const last = scenes.length - 1;
    const picture = { storageId, alt, credit };
    const withPicture =
      use === "cover"
        ? scenes
        : await cleanScenes(
            ctx,
            scenes.map((scene, i) => (i === last ? { ...scene, illustrations: [picture] } : scene)),
          );
    // A cover of its own isn't among the story's pictures; this internal mutation vouches for the upload.
    const cover =
      use === "illustration"
        ? story.cover
        : await cleanCover(
            ctx,
            { kind: "image", ...picture, scale: 1, x: 0, y: 0 },
            { scenes: withPicture, userId: story.authorId, storyFiles: new Set([...before, storageId]) },
          );
    await ctx.db.patch("stories", story._id, { scenes: withPicture, cover });
    await deleteUnusedFiles(ctx, before, filesOf({ scenes: withPicture, cover }));
    return null;
  },
});

// Removes all pictures from one scene of a legend (e.g. an FPO placeholder), and their files unless the
// cover still uses them. Re-imports keep a scene's pictures, so this is the way to take one off.
export const clearScenePictures = internalMutation({
  args: { importId: v.string(), sceneId: v.string() },
  returns: v.number(),
  handler: async (ctx, { importId, sceneId }) => {
    const story = await ctx.db.query("stories").withIndex("by_importId", (q) => q.eq("importId", importId)).unique();
    if (!story) throw new ConvexError(`No story ${importId}.`);
    const scenes = scenesOf(story);
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) throw new ConvexError(`${importId} has no scene ${sceneId}.`);
    const before = filesOf(story);
    const cleared = scenes.map((s) => (s.id === sceneId ? { ...s, illustrations: [] } : s));
    await ctx.db.patch("stories", story._id, { scenes: cleared });
    await deleteUnusedFiles(ctx, before, filesOf({ scenes: cleared, cover: story.cover }));
    return scene.illustrations.length;
  },
});

// The legends' pictures with download links, to copy them to another deployment
// (scripts/export-legend-pictures.ts): each legend's cover and the illustration after its text, as
// setPicture puts them.
const pictureOut = v.object({ storageId: v.id("_storage"), url: v.string(), alt: v.string(), credit: v.optional(v.string()) });
export const pictureList = internalQuery({
  args: {},
  returns: v.array(v.object({ importId: v.string(), title: v.string(), cover: v.union(pictureOut, v.null()), illustration: v.union(pictureOut, v.null()) })),
  handler: async (ctx) => {
    const legends = await ctx.db
      .query("stories")
      .withIndex("by_importId", (q) => q.gt("importId", ""))
      .take(1000);
    const out = [];
    for (const story of legends) {
      const withUrl = async (p: { storageId: Id<"_storage">; alt: string; credit?: string } | undefined) => {
        const url = p && (await ctx.storage.getUrl(p.storageId));
        return p && url ? { storageId: p.storageId, url, alt: p.alt, credit: p.credit } : null;
      };
      const scenes = scenesOf(story);
      const illustration = await withUrl(scenes[scenes.length - 1]?.illustrations[0]);
      const cover = await withUrl(story.cover?.kind === "image" ? story.cover : undefined);
      if (cover || illustration) out.push({ importId: story.importId!, title: story.title, cover, illustration });
    }
    return out;
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
