import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { oneScene, publish, setupUsers } from "./test.setup";

const castle = { lat: 38.6916, lng: -9.2159, place: "Belém Tower", precision: "exact" as const };
const atCastle = { lat: 38.6917, lng: -9.216 };
const elsewhere = { lat: 38.75, lng: -9.1 }; // about 12 km away

afterEach(() => {
  vi.useRealTimers();
});

describe("Recently Played", () => {
  test("lists stories the reader opened, most recent first, without duplicates", async () => {
    const users = await setupUsers();
    const a = await publish(users, { title: "A" });
    const b = await publish(users, { title: "B" });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    await users.reader.mutation(api.library.recordView, { storyId: a });
    vi.setSystemTime(2_000);
    await users.reader.mutation(api.library.recordView, { storyId: b });
    vi.setSystemTime(3_000);
    await users.reader.mutation(api.library.recordView, { storyId: a });

    expect((await users.reader.query(api.library.recentlyPlayed, {})).map((s) => s.title)).toEqual(["A", "B"]);
  });

  test("is private to each reader, and empty when signed out", async () => {
    const users = await setupUsers();
    const a = await publish(users);
    await users.reader.mutation(api.library.recordView, { storyId: a });

    expect(await users.stranger.query(api.library.recentlyPlayed, {})).toEqual([]);
    expect(await users.t.query(api.library.recentlyPlayed, {})).toEqual([]);
    // Opening a story while signed out records nothing and doesn't fail.
    expect(await users.t.mutation(api.library.recordView, { storyId: a })).toBeNull();
  });

  test("ignores stories that aren't published", async () => {
    const users = await setupUsers();
    const draft = await users.author.mutation(api.stories.submit, {
      title: "Draft",
      scenes: oneScene("…"),
      category: "personal",
      ageRange: "6+",
      themes: [],
      source: { kind: "personal" },
      cover: { kind: "colors" },
    });
    await users.author.mutation(api.library.recordView, { storyId: draft });
    expect(await users.author.query(api.library.recentlyPlayed, {})).toEqual([]);
  });
});

describe("Saved stories", () => {
  test("save and unsave, private to the reader", async () => {
    const users = await setupUsers();
    const a = await publish(users);
    await users.reader.mutation(api.library.setSaved, { storyId: a, saved: true });
    await users.reader.mutation(api.library.setSaved, { storyId: a, saved: true });

    expect((await users.reader.query(api.library.saved, {})).map((s) => s._id)).toEqual([a]);
    expect(await users.stranger.query(api.library.saved, {})).toEqual([]);
    expect(await users.reader.query(api.library.storyState, { storyId: a })).toEqual({ saved: true, visited: null });
    expect(await users.t.query(api.library.storyState, { storyId: a })).toBeNull();

    await users.reader.mutation(api.library.setSaved, { storyId: a, saved: false });
    expect(await users.reader.query(api.library.saved, {})).toEqual([]);
    await expect(users.t.mutation(api.library.setSaved, { storyId: a, saved: true })).rejects.toThrow("sign in");
  });
});

describe("Places You've Been", () => {
  test("only comes from explicit actions: marking, or opening/saving while at the place", async () => {
    const users = await setupUsers();
    const story = await publish(users, { location: castle });

    // Opening from far away, or without sharing location, is not a visit.
    await users.reader.mutation(api.library.recordView, { storyId: story, here: elsewhere });
    await users.reader.mutation(api.library.recordView, { storyId: story });
    await users.reader.mutation(api.library.setSaved, { storyId: story, saved: true, here: elsewhere });
    expect(await users.reader.query(api.library.placesVisited, {})).toEqual([]);

    // Opening while at the place is.
    await users.reader.mutation(api.library.recordView, { storyId: story, here: atCastle });
    expect((await users.reader.query(api.library.placesVisited, {})).map((s) => s._id)).toEqual([story]);
    expect((await users.reader.query(api.library.storyState, { storyId: story }))?.visited).toBe("opened_here");
    expect(await users.stranger.query(api.library.placesVisited, {})).toEqual([]);
  });

  test("Mark as visited, and undo it", async () => {
    const users = await setupUsers();
    const story = await publish(users, { location: castle });
    const noPlace = await publish(users);

    await users.reader.mutation(api.library.setVisited, { storyId: story, visited: true });
    expect((await users.reader.query(api.library.placesVisited, {})).map((s) => s._id)).toEqual([story]);
    await users.reader.mutation(api.library.setVisited, { storyId: story, visited: false });
    expect(await users.reader.query(api.library.placesVisited, {})).toEqual([]);

    await expect(users.reader.mutation(api.library.setVisited, { storyId: noPlace, visited: true })).rejects.toThrow(
      "isn't connected to a place",
    );
  });

  test("saving while at the place counts as a visit", async () => {
    const users = await setupUsers();
    const story = await publish(users, { location: castle });
    await users.reader.mutation(api.library.setSaved, { storyId: story, saved: true, here: atCastle });
    expect((await users.reader.query(api.library.storyState, { storyId: story }))?.visited).toBe("saved_here");
  });
});

describe("deleting a story", () => {
  test("removes it from every reader's library and from collections", async () => {
    const users = await setupUsers();
    const story = await publish(users, { location: castle });
    await users.reader.mutation(api.library.recordView, { storyId: story });
    await users.reader.mutation(api.library.setSaved, { storyId: story, saved: true });
    await users.reader.mutation(api.library.setVisited, { storyId: story, visited: true });
    await users.admin.mutation(api.discover.setSeasonal, { storyId: story, featured: true });

    await users.author.mutation(api.stories.remove, { id: story });

    const leftovers = await users.t.run(async (ctx) => [
      ...(await ctx.db.query("savedStories").collect()),
      ...(await ctx.db.query("storyViews").collect()),
      ...(await ctx.db.query("placeVisits").collect()),
      ...(await ctx.db.query("collectionEntries").collect()),
    ]);
    expect(leftovers).toEqual([]);
  });
});
