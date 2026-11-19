import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { distanceKm } from "./geo";
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
  {
    scenes,
    userId,
    storyFiles,
    placeholderFile,
  }: {
    scenes: Scene[];
    userId: Id<"users">;
    storyFiles: Set<Id<"_storage">>;
    // The story's current placeholder tile: kept marked as one while the author leaves it as it is.
    placeholderFile?: Id<"_storage">;
  },
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

  const placeholder = cover.storageId === placeholderFile ? true : undefined;
  return { kind: "image", storageId: cover.storageId, alt, credit, scale, x, y, placeholder };
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

// Gives every published story without a picture a placeholder tile borrowed from another story, so
// no card is blank while the drawings are being made. The tiles are taken in turn (1, 2, 3, … 1, 2, 3)
// in the order of the "New" list (newest first), skipping a tile already shown within `apartKm` so
// neighbours on the map differ. Each is marked `placeholder: true` and points at the same file (nothing
// is copied); a story's own drawing later replaces it (legend-pictures.ts), and the shared file stays
// while other stories use it (`deleteUnusedFiles`). Stories with a tile or pictures of their own are
// never changed. `skip` lists stories whose tile mustn't be reused (printed-book placeholders, tests).
// `dryRun` returns the plan without saving it.
export const fillPlaceholders = internalMutation({
  args: { skip: v.array(v.string()), apartKm: v.number(), dryRun: v.boolean() },
  returns: v.array(v.object({ story: v.string(), tileFrom: v.string() })),
  handler: async (ctx, { skip, apartKm, dryRun }) => {
    const published = await ctx.db
      .query("stories")
      .withIndex("by_status_and_approvedAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .collect();
    const key = (s: Doc<"stories">) => s.importId ?? s.code ?? s._id;
    const tiles = published.filter(
      (s) => s.cover?.kind === "image" && !s.cover.placeholder && !skip.includes(key(s)) && !/placeholder|FPO/i.test(s.cover.credit ?? ""),
    );
    if (tiles.length === 0) throw new ConvexError("No tiles to reuse.");
    // Where each tile already shows, so a neighbour doesn't get the same one.
    const shownAt = new Map(tiles.map((t) => [t._id, [] as { lat: number; lng: number }[]]));
    for (const s of published) {
      if (s.cover?.kind !== "image" || !s.location) continue;
      const source = tiles.find((t) => t.cover?.kind === "image" && s.cover?.kind === "image" && t.cover.storageId === s.cover.storageId);
      if (source) shownAt.get(source._id)!.push(s.location);
    }
    const empty = published.filter((s) => s.cover?.kind !== "image" && storageIdsOf(scenesOf(s)).size === 0);

    const plan: { story: string; tileFrom: string }[] = [];
    let next = 0;
    for (const story of empty) {
      let pick = next;
      for (let tries = 0; tries < tiles.length; tries++) {
        const i = (next + tries) % tiles.length;
        const near = story.location && shownAt.get(tiles[i]._id)!.some((at) => distanceKm(at, story.location!) < apartKm);
        if (!near) {
          pick = i;
          break;
        }
      }
      const tile = tiles[pick];
      next = (pick + 1) % tiles.length;
      if (story.location) shownAt.get(tile._id)!.push(story.location);
      plan.push({ story: story.title, tileFrom: tile.title });
      if (dryRun || tile.cover?.kind !== "image") continue;
      const { storageId, alt, scale, x, y } = tile.cover;
      await ctx.db.patch(story._id, { cover: { kind: "image", storageId, alt, scale, x, y, placeholder: true } });
    }
    return plan;
  },
});
