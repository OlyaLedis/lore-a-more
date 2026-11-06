import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { ageRange, storedCategory, storedTheme, storySource } from "./taxonomy";

export const storyStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

// Category, age, themes, and source. Required for new submissions and edits, but optional here because
// stories written before they existed have none; those are never given made-up values.
export const storyMetadata = {
  // Includes retired categories, which older stories may still have (see legacyCategory).
  category: v.optional(storedCategory),
  ageRange: v.optional(ageRange),
  // Includes retired themes, which older stories may still have (see legacyTheme).
  themes: v.optional(v.array(storedTheme)),
  source: v.optional(storySource),
};

// An illustration in a scene. Files live in Convex storage.
export const illustration = v.object({
  storageId: v.id("_storage"),
  // Describes the picture for readers who can't see it. Required.
  alt: v.string(),
  // Who made the picture, if the author wants to credit them.
  credit: v.optional(v.string()),
});

// One part of a story, in reading order. Stories written before scenes existed have no `scenes`;
// they're read as a single scene made from `body`. The stable `id` lets later additions attach to a
// scene, e.g. an optional sound cue such as { cue: "forest", label: "Play forest sounds" } can be
// added as an optional field without migrating existing scenes.
export const scene = v.object({
  id: v.string(),
  text: v.string(),
  illustrations: v.array(illustration),
});

// A story's card cover. "image" shows a picture inside a white paper frame; `scale`, `x`, and `y` are
// display settings only (the uploaded file is never cropped or changed). "colors" is the author's
// choice of the colorful category cover. Stories without `cover` use their first illustration, or
// the colorful cover if they have none.
export const COVER_SCALE = { min: 0.5, max: 3 };
export const COVER_OFFSET = 0.5;
export const storyCover = v.union(
  v.object({
    kind: v.literal("image"),
    storageId: v.id("_storage"),
    alt: v.string(),
    credit: v.optional(v.string()),
    // 1 fits the whole picture inside the frame's margins.
    scale: v.number(),
    // Offsets as fractions of the frame's inner width/height, from -0.5 to 0.5.
    x: v.number(),
    y: v.number(),
  }),
  v.object({ kind: v.literal("colors") }),
);

// How precisely the pin marks the story's place. A town's center is "area", never "exact".
export const locationPrecision = v.union(
  v.literal("exact"),
  v.literal("area"),
  v.literal("uncertain"),
);

export const storyLocation = v.object({
  lat: v.number(),
  lng: v.number(),
  // Optional human-readable label, e.g. "Kyiv, Ukraine".
  place: v.optional(v.string()),
  // Missing on stories pinned before precision was recorded.
  precision: v.optional(locationPrecision),
});

export default defineSchema({
  ...authTables,
  // Same fields as authTables.users, plus the admin flag. Admins review submissions.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
    // The reader's age range, used to filter Top Picks. Not set until the reader chooses one.
    ageRange: v.optional(ageRange),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  stories: defineTable({
    title: v.string(),
    // The whole text. For stories with scenes it's derived from them, so feeds and search keep working.
    body: v.string(),
    scenes: v.optional(v.array(scene)),
    cover: v.optional(storyCover),
    // Optional pen name shown as the byline; the account itself stays private.
    author: v.optional(v.string()),
    authorId: v.id("users"),
    status: storyStatus,
    // Set when approved, so the feed is ordered by publish time rather than submission time.
    approvedAt: v.optional(v.number()),
    // Where the story takes place. Optional so stories without a pin (and older ones) stay valid.
    location: v.optional(storyLocation),
    ...storyMetadata,
    // Title, place, category, themes, and pen name, for the search index. Kept in sync by every
    // write to those fields; `stories:backfillSearchText` fills it for stories written before search.
    searchText: v.optional(v.string()),
    // Set when an approved edit replaced the published version.
    editedAt: v.optional(v.number()),
    // The permanent public code used in links, e.g. "SP-7K3QX9" (see storyCodes.ts). Optional only
    // because stories saved before codes get theirs from `storyCodes:backfill`.
    code: v.optional(v.string()),
    // For stories imported from a curated collection (the place-bound legends), its key there, e.g.
    // "legend-93", so importing again updates the story instead of adding a copy.
    importId: v.optional(v.string()),
  })
    .index("by_status_and_approvedAt", ["status", "approvedAt"])
    // Missing fields sort before numbers, so a range on location.lat selects only stories with a pin.
    .index("by_status_and_lat", ["status", "location.lat"])
    .index("by_status_and_category_and_approvedAt", ["status", "category", "approvedAt"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["status", "category"] })
    .index("by_authorId", ["authorId"])
    .index("by_code", ["code"])
    .index("by_importId", ["importId"]),
  // An author's edit to an already-published story, waiting for review (or rejected). Readers keep
  // seeing the story's current fields until it's approved. At most one per story: editing again
  // replaces it. Edits to never-published stories change the story directly instead.
  storyRevisions: defineTable({
    storyId: v.id("stories"),
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    scenes: v.optional(v.array(scene)),
    cover: v.optional(storyCover),
    author: v.optional(v.string()),
    location: v.optional(storyLocation),
    ...storyMetadata,
    status: v.union(v.literal("pending"), v.literal("rejected")),
    submittedAt: v.number(),
  })
    .index("by_storyId", ["storyId"])
    .index("by_status_and_submittedAt", ["status", "submittedAt"]),

  // Per-reader history. Only ever read for the signed-in user; one row per reader and story.
  savedStories: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    savedAt: v.number(),
  })
    .index("by_userId_and_savedAt", ["userId", "savedAt"])
    .index("by_userId_and_storyId", ["userId", "storyId"])
    .index("by_storyId", ["storyId"]),
  // "Recently Played": stories the reader opened.
  storyViews: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    viewedAt: v.number(),
  })
    .index("by_userId_and_viewedAt", ["userId", "viewedAt"])
    .index("by_userId_and_storyId", ["userId", "storyId"])
    .index("by_storyId", ["storyId"]),
  // "Places You've Been": only from deliberate actions in the app, never from background tracking.
  // "marked" = Mark as visited; the others = opened or saved the story while near its place.
  placeVisits: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    visitedAt: v.number(),
    how: v.union(v.literal("marked"), v.literal("opened_here"), v.literal("saved_here")),
  })
    .index("by_userId_and_visitedAt", ["userId", "visitedAt"])
    .index("by_userId_and_storyId", ["userId", "storyId"])
    .index("by_storyId", ["storyId"]),

  // Who uploaded a file. A separately uploaded cover is accepted only from the author who uploaded
  // it, so a story can never show a picture that belongs to someone else's story.
  uploads: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
  }).index("by_storageId", ["storageId"]),

  // Where a reader stopped in reading mode: a paragraph or picture anchor like "s2:3".
  readingPositions: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    anchor: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_storyId", ["userId", "storyId"])
    .index("by_storyId", ["storyId"]),

  // Editorial collections, curated by admins without editing the stories themselves.
  collectionEntries: defineTable({
    collection: v.literal("seasonal"),
    storyId: v.id("stories"),
    addedAt: v.number(),
  })
    .index("by_collection_and_addedAt", ["collection", "addedAt"])
    .index("by_collection_and_storyId", ["collection", "storyId"])
    .index("by_storyId", ["storyId"]),

  // A legendary being as one tradition tells it, for the grown-up telling the story: what people
  // believed, what it does, and questions to ask. Drafted from source excerpts and reviewed by an
  // editor (scripts/import-character-cards.ts); see convex/characters.ts.
  characterCards: defineTable({
    // Matches a card file when it's loaded again.
    slug: v.string(),
    name: v.string(),
    localName: v.string(),
    region: v.string(),
    ageRange,
    beliefs: v.array(v.string()),
    plots: v.array(v.string()),
    questions: v.array(v.string()),
    // The excerpts' full citations.
    sources: v.array(v.string()),
  }).index("by_slug", ["slug"]),

  // Which stories a character appears in. One being (a devil, say) can be in many.
  characterStories: defineTable({
    characterId: v.id("characterCards"),
    storyId: v.id("stories"),
  })
    .index("by_characterId", ["characterId"])
    .index("by_storyId", ["storyId"]),
});
