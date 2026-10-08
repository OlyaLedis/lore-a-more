// Permanent public story codes, like "SP-7K3QX9". A story gets one when it's first saved and keeps it
// whatever else changes (title, place, category), so links to /story/SP-7K3QX9 never break. The
// title part of a link (/story/SP-7K3QX9/giant-of-eppstein) is only for people to read.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";

// No 0/O, 1/I/L, so a code can be read aloud or copied from a printed sign without mistakes.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 6;
const CODE = new RegExp(`^SP-[${ALPHABET}]{${LENGTH}}$`);

export function isStoryCode(value: string) {
  return CODE.test(value);
}

// A code no other story has. 31^6 is about 900 million codes, so a clash is rare; retry if it happens.
export async function newStoryCode(ctx: MutationCtx) {
  for (;;) {
    let code = "SP-";
    for (let i = 0; i < LENGTH; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    const taken = await ctx.db
      .query("stories")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!taken) return code;
  }
}

// Finds a story from a link: its code, or (for older links) its database id. Codes are matched
// in any letter case, so a code typed in lowercase still works.
export async function storyFromLink(ctx: QueryCtx, link: string): Promise<Doc<"stories"> | null> {
  const upper = link.toUpperCase();
  if (isStoryCode(upper)) {
    return await ctx.db
      .query("stories")
      .withIndex("by_code", (q) => q.eq("code", upper))
      .unique();
  }
  const id = ctx.db.normalizeId("stories", link);
  return id ? await ctx.db.get(id) : null;
}

// Gives every story without a code one. Run once per deployment after deploying codes:
// npx convex run storyCodes:backfill
export const backfill = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let given = 0;
    for await (const story of ctx.db.query("stories")) {
      if (story.code) continue;
      await ctx.db.patch("stories", story._id, { code: await newStoryCode(ctx) });
      given++;
    }
    return given;
  },
});
