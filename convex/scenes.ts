import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { scene } from "./schema";

export type Scene = Infer<typeof scene>;

export const MAX_SCENES = 50;
export const MAX_ILLUSTRATIONS_PER_SCENE = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ALT = 200;
const MAX_CREDIT = 200;
const MAX_SCENE_ID = 40;

// The id given to the single scene of a story written before scenes existed.
export const LEGACY_SCENE_ID = "s1";

// A story's scenes in reading order. Stories from before scenes are one scene holding `body`.
export function scenesOf(story: Pick<Doc<"stories">, "body" | "scenes">): Scene[] {
  return story.scenes ?? [{ id: LEGACY_SCENE_ID, text: story.body, illustrations: [] }];
}

// The story's full text, derived from its scenes so feeds, search, and review keep using `body`.
export function bodyOf(scenes: Scene[]) {
  return scenes
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function storageIdsOf(scenes: Scene[] | undefined) {
  return new Set((scenes ?? []).flatMap((s) => s.illustrations.map((i) => i.storageId)));
}

// Checks and tidies scenes from an author. Every illustration must be an uploaded image.
export async function cleanScenes(ctx: MutationCtx, scenes: Scene[]): Promise<Scene[]> {
  if (scenes.length === 0) throw new ConvexError("Add at least one scene.");
  if (scenes.length > MAX_SCENES) throw new ConvexError(`A story can have up to ${MAX_SCENES} scenes.`);

  const ids = new Set<string>();
  const cleaned: Scene[] = [];
  for (const [index, s] of scenes.entries()) {
    const n = index + 1;
    if (!s.id || s.id.length > MAX_SCENE_ID || ids.has(s.id)) throw new ConvexError("Scenes need unique ids.");
    ids.add(s.id);

    const text = s.text.trim();
    if (!text && s.illustrations.length === 0)
      throw new ConvexError(`Scene ${n} is empty. Add text or a picture, or remove it.`);
    if (s.illustrations.length > MAX_ILLUSTRATIONS_PER_SCENE)
      throw new ConvexError(`Scene ${n} can have up to ${MAX_ILLUSTRATIONS_PER_SCENE} pictures.`);

    const illustrations = [];
    for (const ill of s.illustrations) {
      const alt = ill.alt.trim();
      const credit = ill.credit?.trim() || undefined;
      if (!alt) throw new ConvexError(`Describe each picture in scene ${n} for readers who can't see it.`);
      if (alt.length > MAX_ALT) throw new ConvexError(`Picture descriptions must be ${MAX_ALT} characters or fewer.`);
      if (credit && credit.length > MAX_CREDIT)
        throw new ConvexError(`Picture credits must be ${MAX_CREDIT} characters or fewer.`);
      await checkImageFile(ctx, ill.storageId, `scene ${n}`);
      illustrations.push({ storageId: ill.storageId, alt, credit });
    }
    cleaned.push({ id: s.id, text, illustrations });
  }
  return cleaned;
}

// Throws unless the file exists and is a picture of at most MAX_IMAGE_BYTES. `where` names it in errors.
export async function checkImageFile(ctx: MutationCtx, id: Id<"_storage">, where: string) {
  const file = await ctx.db.system.get("_storage", id);
  if (!file) throw new ConvexError(`A picture in ${where} is missing. Please upload it again.`);
  if (!file.contentType?.startsWith("image/")) throw new ConvexError(`The file in ${where} isn't a picture.`);
  if (file.size > MAX_IMAGE_BYTES) throw new ConvexError("Pictures must be 5 MB or smaller.");
}

// Scenes with a URL for each illustration, for display.
export async function withImageUrls(ctx: QueryCtx, scenes: Scene[]) {
  return await Promise.all(
    scenes.map(async (s) => ({
      ...s,
      illustrations: await Promise.all(
        s.illustrations.map(async (ill) => ({ ...ill, url: await ctx.storage.getUrl(ill.storageId) })),
      ),
    })),
  );
}

export type SceneWithUrls = Awaited<ReturnType<typeof withImageUrls>>[number];

// Deletes files that were in `before` and are in none of `stillUsed`.
export async function deleteUnusedFiles(
  ctx: MutationCtx,
  before: Set<Id<"_storage">>,
  ...stillUsed: Set<Id<"_storage">>[]
) {
  for (const id of before) {
    if (stillUsed.some((used) => used.has(id))) continue;
    if (await ctx.db.system.get("_storage", id)) await ctx.storage.delete(id);
    const claim = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", id))
      .unique();
    if (claim) await ctx.db.delete(claim._id);
  }
}
