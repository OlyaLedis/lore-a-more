import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { baseStory, publish, setupUsers, type TestUsers } from "./test.setup";

// Stores a file like an author's upload. Real uploads record the Content-Type header; convex-test
// doesn't, so the test sets it on the file's metadata.
async function upload(users: TestUsers, contentType = "image/png") {
  return await users.t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["picture"], { type: contentType }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(id, { contentType });
    return id;
  });
}

async function fileExists(users: TestUsers, id: Id<"_storage">) {
  return (await users.t.run((ctx) => ctx.db.system.get("_storage", id))) !== null;
}

function picture(storageId: Id<"_storage">, alt = "A giant by a castle") {
  return { storageId, alt, credit: "Drawn by Ana" };
}

describe("scenes", () => {
  test("a story written before scenes opens as one scene made from its text", async () => {
    const users = await setupUsers();
    const authorId = await users.author.run(async (ctx) => (await ctx.db.query("users").first())!._id);
    const id = await users.t.run((ctx) =>
      ctx.db.insert("stories", {
        title: "Old",
        body: "First paragraph.\n\nSecond paragraph.",
        authorId,
        status: "approved",
        approvedAt: 1,
      }),
    );

    const story = await users.t.query(api.stories.get, { id });
    expect(story?.scenes).toEqual([{ id: "s1", text: "First paragraph.\n\nSecond paragraph.", illustrations: [] }]);
    expect(story?.body).toBe("First paragraph.\n\nSecond paragraph.");
  });

  test("scenes keep their order, and the story text is derived from them", async () => {
    const users = await setupUsers();
    const file = await upload(users);
    const id = await publish(users, {
      scenes: [
        { id: "a", text: "  The giant woke.  ", illustrations: [] },
        { id: "b", text: "", illustrations: [picture(file)] },
        { id: "c", text: "He walked to the sea.", illustrations: [] },
      ],
    });

    const story = await users.t.query(api.stories.get, { id });
    expect(story?.scenes.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(story?.body).toBe("The giant woke.\n\nHe walked to the sea.");
    const [ill] = story!.scenes[1].illustrations;
    expect(ill).toMatchObject({ alt: "A giant by a castle", credit: "Drawn by Ana" });
    expect(ill.url).toBeTypeOf("string");
  });

  test("rejects bad scenes and pictures", async () => {
    const users = await setupUsers();
    const image = await upload(users);
    const notImage = await upload(users, "application/pdf");
    const submit = (scenes: typeof baseStory.scenes | { id: string; text: string; illustrations: ReturnType<typeof picture>[] }[]) =>
      users.author.mutation(api.stories.submit, { ...baseStory, scenes });

    await expect(submit([])).rejects.toThrow("at least one scene");
    await expect(submit([{ id: "a", text: " ", illustrations: [] }])).rejects.toThrow("Scene 1 is empty");
    await expect(
      submit([
        { id: "a", text: "x", illustrations: [] },
        { id: "a", text: "y", illustrations: [] },
      ]),
    ).rejects.toThrow("unique ids");
    await expect(submit([{ id: "a", text: "x", illustrations: [picture(notImage)] }])).rejects.toThrow(
      "isn't a picture",
    );
    await expect(submit([{ id: "a", text: "x", illustrations: [picture(image, " ")] }])).rejects.toThrow(
      "Describe each picture",
    );
    // A scene with only a picture still needs some text somewhere in the story.
    await expect(submit([{ id: "a", text: "", illustrations: [picture(image)] }])).rejects.toThrow(
      "can't be empty",
    );
  });

  test("only signed-in users can get an upload URL", async () => {
    const users = await setupUsers();
    await expect(users.t.mutation(api.stories.generateUploadUrl, {})).rejects.toThrow("sign in");
    expect(await users.author.mutation(api.stories.generateUploadUrl, {})).toBeTypeOf("string");
  });
});

describe("editing scenes goes through approval", () => {
  test("a published story keeps its scenes and pictures until the edit is approved", async () => {
    const users = await setupUsers();
    const oldPicture = await upload(users);
    const newPicture = await upload(users);
    const id = await publish(users, {
      scenes: [{ id: "a", text: "Before.", illustrations: [picture(oldPicture)] }],
    });

    await users.author.mutation(api.stories.update, {
      id,
      ...baseStory,
      scenes: [
        { id: "a", text: "After.", illustrations: [] },
        { id: "b", text: "New scene.", illustrations: [picture(newPicture)] },
      ],
    });

    // Readers still see the published scenes; the author's form sees the edit.
    const published = await users.t.query(api.stories.get, { id });
    expect(published?.scenes.map((s) => s.text)).toEqual(["Before."]);
    expect((await users.author.query(api.stories.editable, { id }))?.scenes.map((s) => s.text)).toEqual([
      "After.",
      "New scene.",
    ]);
    const [queued] = (await users.admin.query(api.stories.pendingRevisions, {
      paginationOpts: { numItems: 5, cursor: null },
    })).page;
    expect(queued.scenes[1].illustrations[0].url).toBeTypeOf("string");

    await users.admin.mutation(api.stories.reviewRevision, { id: queued._id, decision: "approved" });

    const updated = await users.t.query(api.stories.get, { id });
    expect(updated?.scenes.map((s) => s.text)).toEqual(["After.", "New scene."]);
    expect(updated?.body).toBe("After.\n\nNew scene.");
    // The picture the approved edit dropped is deleted; the new one is kept.
    expect(await fileExists(users, oldPicture)).toBe(false);
    expect(await fileExists(users, newPicture)).toBe(true);
  });

  test("a rejected edit leaves the published pictures in place", async () => {
    const users = await setupUsers();
    const published = await upload(users);
    const id = await publish(users, { scenes: [{ id: "a", text: "Before.", illustrations: [picture(published)] }] });
    await users.author.mutation(api.stories.update, { id, ...baseStory });
    const [queued] = (await users.admin.query(api.stories.pendingRevisions, {
      paginationOpts: { numItems: 5, cursor: null },
    })).page;
    await users.admin.mutation(api.stories.reviewRevision, { id: queued._id, decision: "rejected" });

    expect((await users.t.query(api.stories.get, { id }))?.scenes[0].illustrations).toHaveLength(1);
    expect(await fileExists(users, published)).toBe(true);
  });

  test("replacing a waiting edit deletes its dropped pictures but never the published ones", async () => {
    const users = await setupUsers();
    const published = await upload(users);
    const draft = await upload(users);
    const id = await publish(users, { scenes: [{ id: "a", text: "Text.", illustrations: [picture(published)] }] });

    await users.author.mutation(api.stories.update, {
      id,
      ...baseStory,
      scenes: [{ id: "a", text: "Text.", illustrations: [picture(published), picture(draft)] }],
    });
    await users.author.mutation(api.stories.update, { id, ...baseStory });

    expect(await fileExists(users, draft)).toBe(false);
    expect(await fileExists(users, published)).toBe(true);
  });

  test("deleting a story deletes its pictures and reading positions", async () => {
    const users = await setupUsers();
    const file = await upload(users);
    const id = await publish(users, { scenes: [{ id: "a", text: "Text.", illustrations: [picture(file)] }] });
    await users.reader.mutation(api.library.saveReadingPosition, { storyId: id, anchor: "a:0" });

    await users.author.mutation(api.stories.remove, { id });

    expect(await fileExists(users, file)).toBe(false);
    expect(await users.t.run((ctx) => ctx.db.query("readingPositions").take(10))).toEqual([]);
  });
});

describe("reading position", () => {
  test("is saved per reader, replaced on each save, and private", async () => {
    const users = await setupUsers();
    const id = await publish(users);

    await users.reader.mutation(api.library.saveReadingPosition, { storyId: id, anchor: "s1:2" });
    await users.reader.mutation(api.library.saveReadingPosition, { storyId: id, anchor: "s1:5" });

    expect(await users.reader.query(api.library.readingPosition, { storyId: id })).toBe("s1:5");
    expect(await users.stranger.query(api.library.readingPosition, { storyId: id })).toBeNull();
    expect(await users.t.query(api.library.readingPosition, { storyId: id })).toBeNull();
    expect(await users.t.mutation(api.library.saveReadingPosition, { storyId: id, anchor: "s1:1" })).toBeNull();
    expect(await users.t.run((ctx) => ctx.db.query("readingPositions").take(10))).toHaveLength(1);
  });
});
