/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { StoryCover } from "./covers";
import type { Scene } from "./scenes";
import schema from "./schema";
import type { AgeRange, StoryCategory, StorySource, StoryTheme } from "./taxonomy";

// Every Convex module, for convex-test. Convex skips files with two dots (tests, this file) when
// deploying, so this file never reaches the deployment.
export const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.d.ts",
  "!./**/*.test.ts",
  "!./test.setup.ts",
]);

// A fresh in-memory backend with a writer, a reader, another reader, and an admin.
export async function setupUsers() {
  const t = convexTest(schema, modules);
  const as = async (email: string, isAdmin = false) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", { email, isAdmin }));
    // Convex Auth's getAuthUserId reads the user id from the subject's "userId|sessionId" form.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  return {
    t,
    author: await as("author@example.com"),
    reader: await as("reader@example.com"),
    stranger: await as("stranger@example.com"),
    admin: await as("admin@example.com", true),
  };
}

export type TestUsers = Awaited<ReturnType<typeof setupUsers>>;

// A story told in one scene with no pictures.
export function oneScene(text: string): Scene[] {
  return [{ id: "s1", text, illustrations: [] }];
}

export const baseStory: {
  title: string;
  scenes: ReturnType<typeof oneScene>;
  cover: StoryCover;
  category: StoryCategory;
  ageRange: AgeRange;
  themes: StoryTheme[];
  source: StorySource;
} = {
  title: "The mill",
  scenes: oneScene("Once upon a time."),
  cover: { kind: "colors" },
  category: "wonder_tale",
  ageRange: "6+",
  themes: [],
  source: { kind: "retelling" },
};

// Submits and approves a story as `author`, returning its id.
export async function publish(users: TestUsers, story: Partial<typeof baseStory> & Record<string, unknown> = {}) {
  const id = await users.author.mutation(api.stories.submit, { ...baseStory, ...story });
  await users.admin.mutation(api.stories.review, { id, decision: "approved" });
  return id;
}
