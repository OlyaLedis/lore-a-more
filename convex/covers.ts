import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { checkImageFile, scenesOf, storageIdsOf, type Scene } from "./scenes";
import { COVER_OFFSET, COVER_SCALE, type storyCover } from "./schema";
import { requireUser } from "./users";

export type StoryCover = Infer<typeof storyCover>;

const MAX_ALT = 200;
const MAX_CREDIT = 200;

// Every stored file a story version uses: its scene illustrations and its cover picture.
export function filesOf(doc: { scenes?: Scene[]; cover?: StoryCover } | null | undefined) {
  const files = storageIdsOf(doc?.scenes);
  if (doc?.cover?.kind === "image") files.add(doc.cover.storageId);
  return files;
}

// After uploading a separate cover, the author claims the file so only their stories can use it.
export const claimUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireUser(ctx);
    await checkImageFile(ctx, storageId, "the cover");
    const claim = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (claim && claim.userId !== user._id) throw new ConvexError("That picture belongs to someone else.");
    if (!claim) await ctx.db.insert("uploads", { storageId, userId: user._id });
    return null;
  },
});

// Checks the author's chosen cover. A picture is accepted only if it's one of this story's own
// illustrations, already this story's cover, or a file this author uploaded and claimed.
export async function cleanCover(
  ctx: MutationCtx,
  cover: StoryCover,
  { scenes, userId, storyFiles }: { scenes: Scene[]; userId: Id<"users">; storyFiles: Set<Id<"_storage">> },
): Promise<StoryCover> {
  if (cover.kind === "colors") return { kind: "colors" };

  const inStory = storageIdsOf(scenes).has(cover.storageId) || storyFiles.has(cover.storageId);
  if (!inStory) {
    const claim = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", cover.storageId))
      .unique();
    if (!claim || claim.userId !== userId)
      throw new ConvexError("Choose a cover from this story's pictures, or upload a new one.");
  }
  await checkImageFile(ctx, cover.storageId, "the cover");

  const alt = cover.alt.trim();
  const credit = cover.credit?.trim() || undefined;
  if (!alt) throw new ConvexError("Describe the cover picture for readers who can't see it.");
  if (alt.length > MAX_ALT) throw new ConvexError(`Picture descriptions must be ${MAX_ALT} characters or fewer.`);
  if (credit && credit.length > MAX_CREDIT) throw new ConvexError(`Picture credits must be ${MAX_CREDIT} characters or fewer.`);
  const { scale, x, y } = cover;
  if (![scale, x, y].every(Number.isFinite) || scale < COVER_SCALE.min || scale > COVER_SCALE.max)
    throw new ConvexError("That cover size isn't valid.");
  if (Math.abs(x) > COVER_OFFSET || Math.abs(y) > COVER_OFFSET) throw new ConvexError("That cover position isn't valid.");

  return { kind: "image", storageId: cover.storageId, alt, credit, scale, x, y };
}

// The cover a card shows: the chosen picture with its framing, the first illustration for stories
// that never chose (framed plainly), or null for the colorful category cover.
export async function cardCoverOf(ctx: QueryCtx, story: Pick<Doc<"stories">, "body" | "scenes" | "cover">) {
  if (story.cover?.kind === "colors") return null;
  if (story.cover?.kind === "image") {
    const url = await ctx.storage.getUrl(story.cover.storageId);
    const { alt, scale, x, y } = story.cover;
    return url ? { url, alt, scale, x, y } : null;
  }
  const first = scenesOf(story).flatMap((s) => s.illustrations)[0];
  if (!first) return null;
  const url = await ctx.storage.getUrl(first.storageId);
  return url ? { url, alt: first.alt, scale: 1, x: 0, y: 0 } : null;
}

// A chosen cover with its picture URL, for the edit form and the review queue.
export async function coverWithUrl(ctx: QueryCtx, cover: StoryCover | undefined) {
  if (cover?.kind !== "image") return cover ?? null;
  return { ...cover, url: await ctx.storage.getUrl(cover.storageId) };
}
