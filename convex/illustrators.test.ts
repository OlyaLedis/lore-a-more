import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { cleanUrl, slugFor } from "./illustrators";
import { baseStory, publish, setupUsers, type TestUsers } from "./test.setup";

// Stores a file like an upload, with the Content-Type real uploads record (convex-test doesn't).
async function upload(users: TestUsers, type: string) {
  return await users.t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["file"], { type }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(id, { contentType: type });
    return id;
  });
}

const profile = { name: "Olga Lédis", bio: "Draws in ink.", basedIn: " Helsinki,  Finland ", website: "olga.example.com", links: ["instagram.com/olga"] };

describe("illustrators", () => {
  test("only admins manage profiles", async () => {
    const users = await setupUsers();
    await expect(users.author.mutation(api.illustrators.create, profile)).rejects.toThrow("Only admins");
    await expect(users.reader.query(api.illustrators.list, {})).rejects.toThrow("Only admins");
    const id = await users.admin.mutation(api.illustrators.create, profile);
    const storyId = await publish(users);
    await expect(users.author.mutation(api.illustrators.setForStory, { storyId, illustratorIds: [id] })).rejects.toThrow("Only admins");
  });

  test("a profile has a lasting link and is never made twice", async () => {
    const users = await setupUsers();
    const id = await users.admin.mutation(api.illustrators.create, profile);
    const made = await users.reader.query(api.illustrators.profile, { slug: "olga-ledis" });
    expect(made).toMatchObject({
      name: "Olga Lédis",
      basedIn: "Helsinki, Finland",
      website: "https://olga.example.com/",
      links: ["https://instagram.com/olga"],
      stories: [],
    });
    await expect(users.admin.mutation(api.illustrators.create, { name: " olga  lédis ", links: [] })).rejects.toThrow("already has a profile");

    // Renaming keeps the link.
    await users.admin.mutation(api.illustrators.update, { id, name: "Olga L.", links: [] });
    expect(await users.reader.query(api.illustrators.profile, { slug: "olga-ledis" })).toMatchObject({ name: "Olga L.", bio: null, basedIn: null });
    // Another artist whose name makes the same link gets a numbered one.
    await users.admin.mutation(api.illustrators.create, { name: "Olga Ledis", links: [] });
    expect(await users.reader.query(api.illustrators.profile, { slug: "olga-ledis-2" })).toMatchObject({ name: "Olga Ledis" });
  });

  test("credits and the gallery: published stories only, in credit order", async () => {
    const users = await setupUsers();
    const olga = await users.admin.mutation(api.illustrators.create, { name: "Olga", links: [] });
    const ivo = await users.admin.mutation(api.illustrators.create, { name: "Ivo", links: [] });
    const published = await publish(users, { title: "The linden" });
    const pending = await users.author.mutation(api.stories.submit, { ...baseStory, title: "Not yet" });

    await users.admin.mutation(api.illustrators.setForStory, { storyId: published, illustratorIds: [ivo, olga] });
    await users.admin.mutation(api.illustrators.setForStory, { storyId: pending, illustratorIds: [olga] });

    expect((await users.reader.query(api.illustrators.forStory, { storyId: published })).map((c) => c.name)).toEqual(["Ivo", "Olga"]);
    // An unpublished story's credit shows to its author and admins only.
    expect(await users.reader.query(api.illustrators.forStory, { storyId: pending })).toEqual([]);
    expect(await users.author.query(api.illustrators.forStory, { storyId: pending })).toHaveLength(1);

    const gallery = await users.reader.query(api.illustrators.profile, { slug: "olga" });
    expect(gallery?.stories.map((s) => s.title)).toEqual(["The linden"]);
    const editing = await users.admin.query(api.illustrators.forEditing, { id: olga });
    expect(editing?.stories.map((s) => [s.title, s.status])).toEqual([
      ["Not yet", "pending"],
      ["The linden", "approved"],
    ]);
    expect((await users.admin.query(api.illustrators.list, {})).map((i) => [i.name, i.storyCount])).toEqual([
      ["Ivo", 1],
      ["Olga", 2],
    ]);

    // Assigning again replaces the credit.
    await users.admin.mutation(api.illustrators.setForStory, { storyId: published, illustratorIds: [olga] });
    expect((await users.reader.query(api.illustrators.forStory, { storyId: published })).map((c) => c.name)).toEqual(["Olga"]);
    expect((await users.reader.query(api.illustrators.profile, { slug: "ivo" }))?.stories).toEqual([]);
  });

  test("deleting a story removes it from the gallery", async () => {
    const users = await setupUsers();
    const olga = await users.admin.mutation(api.illustrators.create, { name: "Olga", links: [] });
    const storyId = await publish(users);
    await users.admin.mutation(api.illustrators.setForStory, { storyId, illustratorIds: [olga] });
    await users.author.mutation(api.stories.remove, { id: storyId });
    expect(await users.t.run((ctx) => ctx.db.query("storyIllustrators").take(10))).toEqual([]);
  });

  test("pictures must be pictures, and a new one replaces the old", async () => {
    const users = await setupUsers();
    const id = await users.admin.mutation(api.illustrators.create, { name: "Olga", links: [] });
    const text = await upload(users, "text/plain");
    await expect(users.admin.mutation(api.illustrators.setPicture, { id, kind: "photo", storageId: text })).rejects.toThrow("isn't a picture");
    const first = await upload(users, "image/png");
    const second = await upload(users, "image/png");
    await users.admin.mutation(api.illustrators.setPicture, { id, kind: "photo", storageId: first });
    await users.admin.mutation(api.illustrators.setPicture, { id, kind: "photo", storageId: second });
    expect(await users.t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();
    expect((await users.reader.query(api.illustrators.profile, { slug: "olga" }))?.photoUrl).toBeTruthy();
    // The banner is separate: setting it keeps the portrait, and removing it deletes its file.
    const cover = await upload(users, "image/jpeg");
    await users.admin.mutation(api.illustrators.setPicture, { id, kind: "cover", storageId: cover });
    expect(await users.reader.query(api.illustrators.profile, { slug: "olga" })).toMatchObject({ photoUrl: expect.any(String), coverUrl: expect.any(String) });
    await users.admin.mutation(api.illustrators.setPicture, { id, kind: "cover", storageId: null });
    expect((await users.reader.query(api.illustrators.profile, { slug: "olga" }))?.coverUrl).toBeNull();
    expect(await users.t.run((ctx) => ctx.storage.getUrl(cover))).toBeNull();
  });
});

describe("discovering illustrators", () => {
  async function setup(names: string[], unpublished: string[] = []) {
    const users = await setupUsers();
    const storyId = await publish(users);
    const pending = await users.author.mutation(api.stories.submit, { ...baseStory, title: "Not yet" });
    for (const name of names) {
      const id = await users.admin.mutation(api.illustrators.create, { name, links: [] });
      await users.admin.mutation(api.illustrators.setForStory, { storyId: unpublished.includes(name) ? pending : storyId, illustratorIds: [id] });
    }
    // setForStory replaces a story's credits, so give each published illustrator a story of their own.
    for (const name of names.filter((n) => !unpublished.includes(n))) {
      const id = (await users.admin.query(api.illustrators.list, {})).find((i) => i.name === name)!._id;
      await users.admin.mutation(api.illustrators.setForStory, { storyId: await publish(users, { title: name }), illustratorIds: [id] });
    }
    return users;
  }
  const names = (list: { name: string }[]) => list.map((i) => i.name);

  test("the directory lists only illustrators with a published story", async () => {
    const users = await setup(["Cleo", "Ann", "Ben"], ["Ben"]);
    expect(names(await users.reader.query(api.illustrators.directory, {}))).toEqual(["Ann", "Cleo"]);
  });

  test("three others, never this one, going round in name order", async () => {
    const users = await setup(["Ann", "Ben", "Cleo", "Dora", "Emil"]);
    const fromCleo = await users.reader.query(api.illustrators.others, { slug: "cleo" });
    expect(names(fromCleo.illustrators)).toEqual(["Dora", "Emil", "Ann"]);
    expect(fromCleo.more).toBe(true);
    const fromEmil = await users.reader.query(api.illustrators.others, { slug: "emil" });
    expect(names(fromEmil.illustrators)).toEqual(["Ann", "Ben", "Cleo"]);
  });

  test("fewer than three others, or none", async () => {
    const two = await setup(["Ann", "Ben", "Cleo"]);
    expect(await two.reader.query(api.illustrators.others, { slug: "ann" })).toMatchObject({ more: false });
    expect(names((await two.reader.query(api.illustrators.others, { slug: "ann" })).illustrators)).toEqual(["Ben", "Cleo"]);
    const alone = await setup(["Ann"]);
    expect(await alone.reader.query(api.illustrators.others, { slug: "ann" })).toEqual({ illustrators: [], more: false });
  });

  test("search finds illustrators by name, ignoring case and accents", async () => {
    const users = await setup(["Teodor Marković", "Ann"]);
    expect(names(await users.reader.query(api.illustrators.search, { text: "markovic" }))).toEqual(["Teodor Marković"]);
    expect(await users.reader.query(api.illustrators.search, { text: "  " })).toEqual([]);
  });
});

describe("helpers", () => {
  test("slugFor", () => {
    expect(slugFor("Olga Lédis")).toBe("olga-ledis");
    expect(slugFor("  Jean-Luc  O'Brien ")).toBe("jean-luc-o-brien");
    expect(slugFor("Ольга")).toBe("illustrator");
  });

  test("cleanUrl accepts web addresses only", () => {
    expect(cleanUrl("behance.net/olga", "link")).toBe("https://behance.net/olga");
    expect(cleanUrl("", "link")).toBeUndefined();
    expect(() => cleanUrl("javascript:alert(1)", "link")).toThrow("must start with https://");
    expect(() => cleanUrl("not a link", "link")).toThrow("isn't a web address");
  });
});
