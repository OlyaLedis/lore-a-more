import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { setupUsers } from "./test.setup";

const story = {
  title: "The mill",
  body: "Once upon a time.",
  category: "folktale" as const,
  ageRange: "6+" as const,
  themes: [],
  source: { kind: "retelling" as const },
};
const edited = {
  ...story,
  title: "The old mill",
  body: "Once upon a time, by the river.",
  ageRange: "8+" as const,
  themes: ["forest" as const],
  location: { lat: 49.84, lng: 24.03, place: "Lviv, Ukraine", precision: "area" as const },
};
const page = { paginationOpts: { numItems: 10, cursor: null } };

const setup = setupUsers;

async function publishedStory() {
  const ctx = await setup();
  const id = await ctx.author.mutation(api.stories.submit, story);
  await ctx.admin.mutation(api.stories.review, { id, decision: "approved" });
  return { ...ctx, id };
}

async function pendingRevisionIds(admin: Awaited<ReturnType<typeof setup>>["admin"]) {
  const { page: revisions } = await admin.query(api.stories.pendingRevisions, page);
  return revisions.map((r) => r._id);
}

async function revisionCount(t: Awaited<ReturnType<typeof setup>>["t"], storyId: Id<"stories">) {
  return await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("storyRevisions")
          .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
          .collect()
      ).length,
  );
}

describe("ownership", () => {
  test("only the author can edit a story", async () => {
    const { t, id, stranger, admin } = await publishedStory();
    await expect(stranger.mutation(api.stories.update, { id, ...edited })).rejects.toThrow("Story not found.");
    await expect(admin.mutation(api.stories.update, { id, ...edited })).rejects.toThrow("Story not found.");
    await expect(t.mutation(api.stories.update, { id, ...edited })).rejects.toThrow("sign in");
    expect(await revisionCount(t, id)).toBe(0);
    expect((await t.query(api.stories.get, { id }))?.title).toBe(story.title);
  });

  test("only the author can delete a story", async () => {
    const { t, id, stranger, admin } = await publishedStory();
    await expect(stranger.mutation(api.stories.remove, { id })).rejects.toThrow("Story not found.");
    await expect(admin.mutation(api.stories.remove, { id })).rejects.toThrow("Story not found.");
    await expect(t.mutation(api.stories.remove, { id })).rejects.toThrow("sign in");
    expect(await t.query(api.stories.get, { id })).not.toBeNull();
  });

  test("only the author can load a story for editing, including pending edits", async () => {
    const { t, id, author, stranger, admin } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });
    expect(await stranger.query(api.stories.editable, { id })).toBeNull();
    expect(await admin.query(api.stories.editable, { id })).toBeNull();
    expect(await t.query(api.stories.editable, { id })).toBeNull();
    expect(await author.query(api.stories.editable, { id: "not-an-id" })).toBeNull();
    expect(await author.query(api.stories.editable, { id })).toMatchObject({
      ...edited,
      status: "approved",
      revisionStatus: "pending",
    });
  });

  test("only admins can review edits", async () => {
    const { id, author } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });
    const revisionId = await author.run(async (ctx) => (await ctx.db.query("storyRevisions").first())!._id);
    await expect(author.mutation(api.stories.reviewRevision, { id: revisionId, decision: "approved" })).rejects.toThrow(
      "Only admins",
    );
    await expect(author.query(api.stories.pendingRevisions, page)).rejects.toThrow("Only admins");
  });
});

describe("approval lifecycle", () => {
  test("a new story stays hidden until approved", async () => {
    const { t, author, admin } = await setup();
    const id = await author.mutation(api.stories.submit, story);
    expect((await t.query(api.stories.list, page)).page).toHaveLength(0);
    expect(await t.query(api.stories.get, { id })).toBeNull();

    await admin.mutation(api.stories.review, { id, decision: "approved" });
    expect((await t.query(api.stories.list, page)).page.map((s) => s._id)).toEqual([id]);
  });

  test("editing a published story keeps the published version public until the edit is approved", async () => {
    const { t, id, author, admin } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });

    // Readers still see the original.
    const published = await t.query(api.stories.get, { id });
    expect(published).toMatchObject({ ...story, status: "approved" });
    expect(published?.location).toBeUndefined();
    expect((await t.query(api.stories.list, page)).page[0].title).toBe(story.title);
    expect(await t.query(api.stories.mapped, {})).toEqual([]);

    // The author sees the edit is pending; the moderator sees it in the queue.
    const [mine] = (await author.query(api.stories.mine, page)).page;
    expect(mine).toMatchObject({ status: "approved", revisionStatus: "pending" });
    const [queued] = (await admin.query(api.stories.pendingRevisions, page)).page;
    expect(queued).toMatchObject({ storyId: id, title: edited.title, publishedTitle: story.title });

    await admin.mutation(api.stories.reviewRevision, { id: queued._id, decision: "approved" });

    const updated = await t.query(api.stories.get, { id });
    expect(updated).toMatchObject({ ...edited, status: "approved" });
    expect(updated?.editedAt).toBeTypeOf("number");
    expect((await t.query(api.stories.mapped, {})).map((s) => s._id)).toEqual([id]);
    expect(await revisionCount(t, id)).toBe(0);
    expect((await author.query(api.stories.mine, page)).page[0].revisionStatus).toBeNull();
  });

  test("editing again replaces the pending edit instead of adding a second one", async () => {
    const { t, id, author, admin } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });
    await author.mutation(api.stories.update, { id, ...edited, title: "Third try" });

    expect(await revisionCount(t, id)).toBe(1);
    const queued = (await admin.query(api.stories.pendingRevisions, page)).page;
    expect(queued.map((r) => r.title)).toEqual(["Third try"]);
  });

  test("a rejected edit leaves the published version and shows the author it was rejected", async () => {
    const { t, id, author, admin } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });
    const [revisionId] = await pendingRevisionIds(admin);
    await admin.mutation(api.stories.reviewRevision, { id: revisionId, decision: "rejected" });

    expect(await t.query(api.stories.get, { id })).toMatchObject({ ...story, status: "approved" });
    expect((await author.query(api.stories.mine, page)).page[0].revisionStatus).toBe("rejected");
    expect(await pendingRevisionIds(admin)).toEqual([]);
    // The edit form starts from the rejected edit, so the author can fix it.
    expect((await author.query(api.stories.editable, { id }))?.title).toBe(edited.title);
    await expect(admin.mutation(api.stories.reviewRevision, { id: revisionId, decision: "approved" })).rejects.toThrow(
      "already reviewed",
    );

    // Resubmitting puts it back in the queue.
    await author.mutation(api.stories.update, { id, ...edited, title: "Fixed" });
    expect((await author.query(api.stories.mine, page)).page[0].revisionStatus).toBe("pending");
    expect(await pendingRevisionIds(admin)).toHaveLength(1);
    expect(await revisionCount(t, id)).toBe(1);
  });

  test("editing a never-published story changes it directly and sends it back for review", async () => {
    const { t, author, admin } = await setup();
    const id = await author.mutation(api.stories.submit, story);
    await admin.mutation(api.stories.review, { id, decision: "rejected" });

    await author.mutation(api.stories.update, { id, ...edited });

    expect(await author.query(api.stories.get, { id })).toMatchObject({ ...edited, status: "pending" });
    expect(await revisionCount(t, id)).toBe(0);
    expect((await admin.query(api.stories.pending, page)).page.map((s) => s._id)).toEqual([id]);
  });

  test("an edit can remove the location", async () => {
    const { t, author, admin } = await setup();
    const id = await author.mutation(api.stories.submit, { ...story, location: edited.location });
    await admin.mutation(api.stories.review, { id, decision: "approved" });
    await author.mutation(api.stories.update, { id, ...story });
    const [revisionId] = await pendingRevisionIds(admin);
    await admin.mutation(api.stories.reviewRevision, { id: revisionId, decision: "approved" });
    expect((await t.query(api.stories.get, { id }))?.location).toBeUndefined();
  });

  test("edits are validated like new stories", async () => {
    const { id, author } = await publishedStory();
    await expect(author.mutation(api.stories.update, { id, ...edited, title: "  " })).rejects.toThrow(
      "Title is required.",
    );
    await expect(
      author.mutation(api.stories.update, { id, ...edited, location: { ...edited.location, lat: 120 } }),
    ).rejects.toThrow("isn't valid");
  });

  test("deleting a story removes it and its pending edit everywhere", async () => {
    const { t, id, author, admin } = await publishedStory();
    await author.mutation(api.stories.update, { id, ...edited });
    const [revisionId] = await pendingRevisionIds(admin);

    await author.mutation(api.stories.remove, { id });

    expect(await t.query(api.stories.get, { id })).toBeNull();
    expect((await t.query(api.stories.list, page)).page).toEqual([]);
    expect((await author.query(api.stories.mine, page)).page).toEqual([]);
    expect(await pendingRevisionIds(admin)).toEqual([]);
    expect(await revisionCount(t, id)).toBe(0);
    // A moderator who still has the edit open gets a clear error.
    await expect(admin.mutation(api.stories.reviewRevision, { id: revisionId, decision: "approved" })).rejects.toThrow(
      "withdrawn",
    );
  });
});
