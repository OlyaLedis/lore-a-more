import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { ageRange } from "./taxonomy";

export async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You need to sign in first.");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("You need to sign in first.");
  return user;
}

export async function requireAdmin(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (!user.isAdmin) throw new ConvexError("Only admins can do that.");
  return user;
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { _id: user._id, email: user.email, isAdmin: user.isAdmin === true, ageRange: user.ageRange ?? null };
  },
});

// The reader's age range for Top Picks, or null to show all ages.
export const setAgeRange = mutation({
  args: { ageRange: v.union(ageRange, v.null()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { ageRange: args.ageRange ?? undefined });
  },
});

// Grant or revoke review rights. Internal, so only someone with deployment access can run it:
//   npx convex run users:setAdmin '{"email":"olga@example.com"}'
export const setAdmin = internalMutation({
  args: { email: v.string(), isAdmin: v.optional(v.boolean()) },
  handler: async (ctx, { email, isAdmin = true }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new ConvexError(`No account with email ${email}. Sign up first.`);
    await ctx.db.patch(user._id, { isAdmin });
    return `${email} isAdmin=${isAdmin}`;
  },
});
