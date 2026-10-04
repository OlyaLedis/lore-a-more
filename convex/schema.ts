import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { ageRange, storyCategory, storySource, storyTheme } from "./taxonomy";

export const storyStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

// Category, age, themes, and source. Required for new submissions and edits, but optional here because
// stories written before they existed have none; those are never given made-up values.
export const storyMetadata = {
  category: v.optional(storyCategory),
  ageRange: v.optional(ageRange),
  themes: v.optional(v.array(storyTheme)),
  source: v.optional(storySource),
};

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
    body: v.string(),
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
  })
    .index("by_status_and_approvedAt", ["status", "approvedAt"])
    // Missing fields sort before numbers, so a range on location.lat selects only stories with a pin.
    .index("by_status_and_lat", ["status", "location.lat"])
    .index("by_status_and_category_and_approvedAt", ["status", "category", "approvedAt"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["status", "category"] })
    .index("by_authorId", ["authorId"]),
  // An author's edit to an already-published story, waiting for review (or rejected). Readers keep
  // seeing the story's current fields until it's approved. At most one per story: editing again
  // replaces it. Edits to never-published stories change the story directly instead.
  storyRevisions: defineTable({
    storyId: v.id("stories"),
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
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

  // Editorial collections, curated by admins without editing the stories themselves.
  collectionEntries: defineTable({
    collection: v.literal("seasonal"),
    storyId: v.id("stories"),
    addedAt: v.number(),
  })
    .index("by_collection_and_addedAt", ["collection", "addedAt"])
    .index("by_collection_and_storyId", ["collection", "storyId"])
    .index("by_storyId", ["storyId"]),
});
