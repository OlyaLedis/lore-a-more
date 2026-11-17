// Illustrators: the artists who draw the stories' pictures. Each has a public profile at
// /illustrator/<slug> (a small portfolio: photo, bio, links, and a gallery of the published stories they
// illustrated), and each illustrated story credits them ("Illustrated by …"). Admins create and edit
// profiles and assign them to stories; only the name is required.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { checkImageFile } from "./scenes";
import { toCard } from "./storyCards";
import { requireAdmin } from "./users";

const MAX_NAME = 100;
const MAX_BIO = 1500;
const MAX_URL = 500;
const MAX_LINKS = 8;
const MAX_PER_STORY = 6;
// The gallery shows at most this many stories (a portfolio, not an archive).
const MAX_GALLERY = 200;

// "Olga Lédis" → "olga-ledis". Letters outside a–z (Cyrillic, say) drop out, so a name made only of them
// falls back to "illustrator"; `uniqueSlug` adds a number when needed.
export function slugFor(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "illustrator";
}

async function uniqueSlug(ctx: QueryCtx, name: string) {
  const base = slugFor(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await ctx.db.query("illustrators").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!taken) return slug;
  }
}

const nameKeyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// An http(s) link, with "https://" added when it's left out ("behance.net/olga"). Anything else is refused.
export function cleanUrl(input: string, what: string) {
  const text = input.trim();
  if (!text) return undefined;
  if (text.length > MAX_URL) throw new ConvexError(`The ${what} is too long.`);
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new ConvexError(`The ${what} isn't a web address.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ConvexError(`The ${what} must start with https://.`);
  if (!url.hostname.includes(".")) throw new ConvexError(`The ${what} isn't a web address.`);
  return url.toString();
}

const MAX_BASED_IN = 100;

function cleanBasedIn(basedIn: string | undefined) {
  const text = basedIn?.trim().replace(/\s+/g, " ") || undefined;
  if (text && text.length > MAX_BASED_IN) throw new ConvexError(`Where they're based is at most ${MAX_BASED_IN} characters.`);
  return text;
}

const profileFields = {
  name: v.string(),
  bio: v.optional(v.string()),
  basedIn: v.optional(v.string()),
  website: v.optional(v.string()),
  links: v.array(v.string()),
};

function cleanProfile({ name, bio, basedIn, website, links }: { name: string; bio?: string; basedIn?: string; website?: string; links: string[] }) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!cleanName) throw new ConvexError("An illustrator needs a name.");
  if (cleanName.length > MAX_NAME) throw new ConvexError(`The name is at most ${MAX_NAME} characters.`);
  const cleanBio = bio?.trim() || undefined;
  if (cleanBio && cleanBio.length > MAX_BIO) throw new ConvexError(`The biography is at most ${MAX_BIO} characters.`);
  const cleanLinks = [...new Set(links.map((link) => cleanUrl(link, "link")).filter((l): l is string => !!l))];
  if (cleanLinks.length > MAX_LINKS) throw new ConvexError(`At most ${MAX_LINKS} links.`);
  return {
    name: cleanName,
    nameKey: nameKeyOf(cleanName),
    bio: cleanBio,
    basedIn: cleanBasedIn(basedIn),
    website: website === undefined ? undefined : cleanUrl(website, "website"),
    links: cleanLinks,
  };
}

async function photoUrl(ctx: QueryCtx, illustrator: Doc<"illustrators">) {
  return illustrator.photo ? await ctx.storage.getUrl(illustrator.photo) : null;
}

async function coverUrl(ctx: QueryCtx, illustrator: Doc<"illustrators">) {
  return illustrator.cover ? await ctx.storage.getUrl(illustrator.cover) : null;
}

// The illustrators' stories, newest link first.
async function linksOf(ctx: QueryCtx, illustratorId: Id<"illustrators">, limit: number) {
  return await ctx.db
    .query("storyIllustrators")
    .withIndex("by_illustratorId", (q) => q.eq("illustratorId", illustratorId))
    .order("desc")
    .take(limit);
}

// --- Public ---

// An illustrator's profile and the published stories they illustrated, or null.
export const profile = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const illustrator = await ctx.db
      .query("illustrators")
      .withIndex("by_slug", (q) => q.eq("slug", slug.toLowerCase()))
      .unique();
    if (!illustrator) return null;
    const stories = [];
    // Where the stories happen, for the map in the banner.
    const places = [];
    for (const link of await linksOf(ctx, illustrator._id, MAX_GALLERY)) {
      const story = await ctx.db.get(link.storyId);
      if (story?.status !== "approved") continue;
      stories.push(await toCard(ctx, story));
      if (story.location) {
        places.push({ _id: story._id, code: story.code, title: story.title, lat: story.location.lat, lng: story.location.lng, place: story.location.place ?? "" });
      }
    }
    return {
      _id: illustrator._id,
      slug: illustrator.slug,
      name: illustrator.name,
      bio: illustrator.bio ?? null,
      basedIn: illustrator.basedIn ?? null,
      website: illustrator.website ?? null,
      links: illustrator.links,
      photoUrl: await photoUrl(ctx, illustrator),
      coverUrl: await coverUrl(ctx, illustrator),
      stories,
      places,
    };
  },
});

async function creditsOf(ctx: QueryCtx, storyId: Id<"stories">) {
  const links = await ctx.db
    .query("storyIllustrators")
    .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
    .take(MAX_PER_STORY * 2);
  links.sort((a, b) => a.order - b.order);
  const credits = [];
  for (const link of links) {
    const illustrator = await ctx.db.get(link.illustratorId);
    if (illustrator) credits.push({ _id: illustrator._id, name: illustrator.name, slug: illustrator.slug });
  }
  return credits;
}

// "Illustrated by …" for a story page: for published stories, and for anyone who may see the story
// unpublished (its author, an admin).
export const forStory = query({
  args: { storyId: v.id("stories") },
  returns: v.array(v.object({ _id: v.id("illustrators"), name: v.string(), slug: v.string() })),
  handler: async (ctx, { storyId }) => {
    const story = await ctx.db.get(storyId);
    if (!story) return [];
    if (story.status !== "approved") {
      const userId = await getAuthUserId(ctx);
      const user = userId && (await ctx.db.get(userId));
      if (!user || (user._id !== story.authorId && !user.isAdmin)) return [];
    }
    return await creditsOf(ctx, storyId);
  },
});

// How many of an illustrator's stories are published (counting stops at `limit`).
async function publishedCount(ctx: QueryCtx, illustratorId: Id<"illustrators">, limit = MAX_GALLERY) {
  let count = 0;
  for (const link of await linksOf(ctx, illustratorId, MAX_GALLERY)) {
    if ((await ctx.db.get(link.storyId))?.status === "approved" && ++count >= limit) break;
  }
  return count;
}

// The illustrators readers can discover: those with at least one published story, by name. A profile with
// nothing published yet still has its own page, but isn't suggested or listed.
async function published(ctx: QueryCtx) {
  const all = await ctx.db.query("illustrators").withIndex("by_nameKey").take(500);
  const shown = [];
  for (const illustrator of all) {
    const storyCount = await publishedCount(ctx, illustrator._id);
    if (storyCount > 0) {
      shown.push({ _id: illustrator._id, slug: illustrator.slug, name: illustrator.name, nameKey: illustrator.nameKey, storyCount, photoUrl: await photoUrl(ctx, illustrator) });
    }
  }
  return shown;
}

const card = v.object({ _id: v.id("illustrators"), slug: v.string(), name: v.string(), storyCount: v.number(), photoUrl: v.union(v.string(), v.null()) });
const toCardOut = ({ nameKey: _nameKey, ...rest }: Awaited<ReturnType<typeof published>>[number]) => rest;

// The public directory at /illustrators.
export const directory = query({
  args: {},
  returns: v.array(card),
  handler: async (ctx) => (await published(ctx)).map(toCardOut),
});

// "Discover More Illustrators" on a profile: up to three others, never this one. They're the next ones
// after this artist in name order (going round), so each profile suggests different artists and every
// artist is suggested somewhere. `more` says whether the directory has others besides these.
export const others = query({
  args: { slug: v.string(), count: v.optional(v.number()) },
  returns: v.object({ illustrators: v.array(card), more: v.boolean() }),
  handler: async (ctx, { slug, count = 3 }) => {
    const all = await published(ctx);
    const here = all.findIndex((i) => i.slug === slug);
    const rest = here < 0 ? all : [...all.slice(here + 1), ...all.slice(0, here)];
    const n = Math.max(0, Math.min(count, 6));
    return { illustrators: rest.slice(0, n).map(toCardOut), more: rest.length > n };
  },
});

// Illustrators whose name contains the search text (any case, accents ignored), for the Search page.
export const search = query({
  args: { text: v.string() },
  returns: v.array(card),
  handler: async (ctx, { text }) => {
    const plain = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const words = plain(text).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return (await published(ctx))
      .filter((i) => words.every((w) => plain(i.nameKey).includes(w)))
      .slice(0, 12)
      .map(toCardOut);
  },
});

// --- Admin ---

// All illustrators, by name, with how many stories each has (up to 100 shown as "100+").
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("illustrators").withIndex("by_nameKey").take(500);
    return await Promise.all(
      all.map(async (illustrator) => ({
        _id: illustrator._id,
        slug: illustrator.slug,
        name: illustrator.name,
        photoUrl: await photoUrl(ctx, illustrator),
      coverUrl: await coverUrl(ctx, illustrator),
        storyCount: (await linksOf(ctx, illustrator._id, 101)).length,
      })),
    );
  },
});

// One illustrator for the edit form, with every story assigned to them, published or not.
export const forEditing = query({
  args: { id: v.id("illustrators") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const illustrator = await ctx.db.get(id);
    if (!illustrator) return null;
    const stories = [];
    for (const link of await linksOf(ctx, id, MAX_GALLERY)) {
      const story = await ctx.db.get(link.storyId);
      if (story) stories.push({ ...(await toCard(ctx, story)), status: story.status });
    }
    return {
      _id: illustrator._id,
      slug: illustrator.slug,
      name: illustrator.name,
      bio: illustrator.bio ?? "",
      basedIn: illustrator.basedIn ?? "",
      website: illustrator.website ?? "",
      links: illustrator.links,
      photoUrl: await photoUrl(ctx, illustrator),
      coverUrl: await coverUrl(ctx, illustrator),
      stories,
    };
  },
});

// Makes a profile, or returns the existing one with the same name instead of a duplicate.
export const create = mutation({
  args: profileFields,
  returns: v.id("illustrators"),
  handler: async (ctx, fields) => {
    await requireAdmin(ctx);
    const clean = cleanProfile(fields);
    const existing = await ctx.db
      .query("illustrators")
      .withIndex("by_nameKey", (q) => q.eq("nameKey", clean.nameKey))
      .first();
    if (existing) throw new ConvexError(`${existing.name} already has a profile. Open it from the list instead.`);
    return await ctx.db.insert("illustrators", { ...clean, slug: await uniqueSlug(ctx, clean.name) });
  },
});

// Edits a profile. Its link (slug) stays the same even when the name changes, so shared links keep working.
export const update = mutation({
  args: { id: v.id("illustrators"), ...profileFields },
  returns: v.null(),
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const illustrator = await ctx.db.get(id);
    if (!illustrator) throw new ConvexError("That illustrator no longer exists.");
    const clean = cleanProfile(fields);
    const sameName = await ctx.db
      .query("illustrators")
      .withIndex("by_nameKey", (q) => q.eq("nameKey", clean.nameKey))
      .first();
    if (sameName && sameName._id !== id) throw new ConvexError(`${sameName.name} already has a profile.`);
    await ctx.db.patch(id, clean);
    return null;
  },
});

export const photoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Sets (or, with null, removes) the profile picture ("photo", the portrait in a circle) or the banner
// ("cover"), deleting the file it replaces.
export const setPicture = mutation({
  args: { id: v.id("illustrators"), kind: v.union(v.literal("photo"), v.literal("cover")), storageId: v.union(v.id("_storage"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { id, kind, storageId }) => {
    await requireAdmin(ctx);
    const illustrator = await ctx.db.get(id);
    if (!illustrator) throw new ConvexError("That illustrator no longer exists.");
    if (storageId) await checkImageFile(ctx, storageId, "the profile");
    await ctx.db.patch(id, { [kind]: storageId ?? undefined });
    const before = illustrator[kind];
    if (before && before !== storageId) await deletePhoto(ctx, before);
    return null;
  },
});

async function deletePhoto(ctx: MutationCtx, id: Id<"_storage">) {
  if (await ctx.db.system.get("_storage", id)) await ctx.storage.delete(id);
}

// Who illustrated a story, in credit order (an empty list removes the credit). The gallery of each
// illustrator follows automatically.
export const setForStory = mutation({
  args: { storyId: v.id("stories"), illustratorIds: v.array(v.id("illustrators")) },
  returns: v.null(),
  handler: async (ctx, { storyId, illustratorIds }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(storyId))) throw new ConvexError("That story no longer exists.");
    const ids = [...new Set(illustratorIds)];
    if (ids.length > MAX_PER_STORY) throw new ConvexError(`At most ${MAX_PER_STORY} illustrators per story.`);
    for (const id of ids) if (!(await ctx.db.get(id))) throw new ConvexError("One of those illustrators no longer exists.");
    for await (const link of ctx.db.query("storyIllustrators").withIndex("by_storyId", (q) => q.eq("storyId", storyId))) {
      await ctx.db.delete(link._id);
    }
    for (const [order, illustratorId] of ids.entries()) await ctx.db.insert("storyIllustrators", { storyId, illustratorId, order });
    return null;
  },
});
