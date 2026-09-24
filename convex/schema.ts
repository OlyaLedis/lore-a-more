import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const storyStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

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
  })
    .index("by_status_and_approvedAt", ["status", "approvedAt"])
    .index("by_authorId", ["authorId"]),
});
