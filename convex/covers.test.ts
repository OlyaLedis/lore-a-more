import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { baseStory, publish, setupUsers, type TestUsers } from "./test.setup";

// Stores a file like an upload, with the Content-Type real uploads record (convex-test doesn't).
async function upload(users: TestUsers) {
  return await users.t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["picture"], { type: "image/png" }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(id, {
      contentType: "image/png",
    });
    return id;
  });
}

async function fileExists(users: TestUsers, id: Id<"_storage">) {
  return (await users.t.run((ctx) => ctx.db.system.get("_storage", id))) !== null;
}

function imageCover(storageId: Id<"_storage">, framing = { scale: 1, x: 0, y: 0 }) {
  return { kind: "image" as const, storageId, alt: "A giant by a castle", credit: "Drawn by Ana", ...framing };
}

function withPicture(storageId: Id<"_storage">) {
  return [{ id: "a", text: "Once.", illustrations: [{ storageId, alt: "A giant", credit: "Ana" }] }];
}

async function cardFor(users: TestUsers, id: Id<"stories">) {
  return (await users.t.query(api.discover.search, {})).find((s) => s._id === id);
}

describe("choosing a cover", () => {
  test("one of the story's own pictures can be the cover, with its framing", async () => {
    const users = await setupUsers();
    const pic = await upload(users);
    const framing = { scale: 1.4, x: -0.1, y: 0.2 };
    const place = { lat: 39.81, lng: 9.27, place: "Sadali", precision: "area" as const };
    const id = await publish(users, { scenes: withPicture(pic), cover: imageCover(pic, framing), location: place });

    const card = await cardFor(users, id);
    expect(card?.cover).toMatchObject({ alt: "A giant by a castle", ...framing });
    expect(card?.cover?.url).toBeTypeOf("string");
    // The map preview uses the same cover.
    const [pin] = await users.t.query(api.stories.mapped, {});
    expect(pin.cover).toEqual(card?.cover);
  });

  test("the colorful cover can be chosen even when the story has pictures", async () => {
    const users = await setupUsers();
    const pic = await upload(users);
    const id = await publish(users, { scenes: withPicture(pic), cover: { kind: "colors" } });
    expect((await cardFor(users, id))?.cover).toBeNull();
  });

  test("stories that never chose a cover show their first picture, or the colorful cover", async () => {
    const users = await setupUsers();
    const pic = await upload(users);
    const authorId = await users.t.run(async (ctx) => (await ctx.db.query("users").first())!._id);
    const [illustrated, plain] = await users.t.run(async (ctx) => [
      await ctx.db.insert("stories", {
        title: "Old with picture",
        body: "Once.",
        scenes: withPicture(pic),
        authorId,
        status: "approved",
        approvedAt: 2,
      }),
      await ctx.db.insert("stories", { title: "Old", body: "Once.", authorId, status: "approved", approvedAt: 1 }),
    ]);

    expect((await cardFor(users, illustrated))?.cover).toMatchObject({ alt: "A giant", scale: 1, x: 0, y: 0 });
    expect((await cardFor(users, plain))?.cover).toBeNull();
  });

  test("a separately uploaded cover is accepted only from the author who uploaded and claimed it", async () => {
    const users = await setupUsers();
    const mine = await upload(users);
    const unclaimed = await upload(users);
    const theirs = await upload(users);
    await users.author.mutation(api.covers.claimUpload, { storageId: mine });
    await users.stranger.mutation(api.covers.claimUpload, { storageId: theirs });

    await expect(users.author.mutation(api.covers.claimUpload, { storageId: theirs })).rejects.toThrow(
      "belongs to someone else",
    );
    for (const storageId of [unclaimed, theirs]) {
      await expect(users.author.mutation(api.stories.submit, { ...baseStory, cover: imageCover(storageId) })).rejects.toThrow(
        "Choose a cover from this story's pictures",
      );
    }
    const id = await users.author.mutation(api.stories.submit, { ...baseStory, cover: imageCover(mine) });
    expect(id).toBeTruthy();
  });

  test("a picture from another story can't be used as a cover", async () => {
    const users = await setupUsers();
    const otherPicture = await upload(users);
    await publish(users, { scenes: withPicture(otherPicture) });

    // Same author, different story: the picture isn't part of this story and wasn't uploaded as a cover.
    await expect(
      users.author.mutation(api.stories.submit, { ...baseStory, cover: imageCover(otherPicture) }),
    ).rejects.toThrow("Choose a cover from this story's pictures");
    await expect(
      users.stranger.mutation(api.stories.submit, { ...baseStory, cover: imageCover(otherPicture) }),
    ).rejects.toThrow("Choose a cover from this story's pictures");
  });

  test("rejects a missing description or framing out of range", async () => {
    const users = await setupUsers();
    const pic = await upload(users);
    const submit = (cover: ReturnType<typeof imageCover>) =>
      users.author.mutation(api.stories.submit, { ...baseStory, scenes: withPicture(pic), cover });

    await expect(submit({ ...imageCover(pic), alt: " " })).rejects.toThrow("Describe the cover picture");
    await expect(submit(imageCover(pic, { scale: 5, x: 0, y: 0 }))).rejects.toThrow("cover size");
    await expect(submit(imageCover(pic, { scale: 1, x: 0.9, y: 0 }))).rejects.toThrow("cover position");
  });
});

describe("changing the cover of a published story", () => {
  test("waits for approval, then replaces the cover and deletes the old uploaded file", async () => {
    const users = await setupUsers();
    const oldCover = await upload(users);
    const newCover = await upload(users);
    await users.author.mutation(api.covers.claimUpload, { storageId: oldCover });
    await users.author.mutation(api.covers.claimUpload, { storageId: newCover });
    const id = await publish(users, { cover: imageCover(oldCover) });

    await users.author.mutation(api.stories.update, { id, ...baseStory, cover: imageCover(newCover, { scale: 2, x: 0, y: 0 }) });

    // Readers still see the old cover; the edit form and the review queue see the new one.
    expect((await cardFor(users, id))?.cover?.scale).toBe(1);
    expect((await users.author.query(api.stories.editable, { id }))?.cover).toMatchObject({ storageId: newCover, scale: 2 });
    const [revision] = (await users.admin.query(api.stories.pendingRevisions, {
      paginationOpts: { numItems: 5, cursor: null },
    })).page;
    expect(revision.cardCover?.scale).toBe(2);

    await users.admin.mutation(api.stories.reviewRevision, { id: revision._id, decision: "approved" });

    expect((await cardFor(users, id))?.cover?.scale).toBe(2);
    expect(await fileExists(users, oldCover)).toBe(false);
    expect(await fileExists(users, newCover)).toBe(true);
  });

  test("deleting a story deletes its uploaded cover", async () => {
    const users = await setupUsers();
    const cover = await upload(users);
    await users.author.mutation(api.covers.claimUpload, { storageId: cover });
    const id = await publish(users, { cover: imageCover(cover) });

    await users.author.mutation(api.stories.remove, { id });

    expect(await fileExists(users, cover)).toBe(false);
    expect(await users.t.run((ctx) => ctx.db.query("uploads").take(5))).toEqual([]);
  });
});
