import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { publish, setupUsers } from "./test.setup";

const lisbon = { lat: 38.7139, lng: -9.1394, place: "Lisbon, Portugal", precision: "area" as const };
const porto = { lat: 41.1496, lng: -8.611, place: "Porto, Portugal", precision: "area" as const };
const inLisbon = { lat: 38.72, lng: -9.14 };

afterEach(() => {
  vi.useRealTimers();
});

describe("search and filters", () => {
  test("finds published stories by title, place, category, and theme words", async () => {
    const users = await setupUsers();
    const castle = await publish(users, {
      title: "The giant of the castle",
      category: "local_legend",
      themes: ["castles", "giants"],
      location: lisbon,
    });
    await publish(users, { title: "Grandma's kitchen", category: "personal", themes: ["family"] });
    // Pending stories never show up.
    await users.author.mutation(api.stories.submit, {
      title: "Castle draft",
      body: "…",
      category: "local_legend",
      ageRange: "6+",
      themes: ["castles"],
      source: { kind: "personal" },
    });

    const ids = async (args: Record<string, string>) =>
      (await users.t.query(api.discover.search, args)).map((s) => s._id);
    expect(await ids({ text: "castle" })).toEqual([castle]);
    expect(await ids({ text: "Lisbon" })).toEqual([castle]);
    expect(await ids({ text: "legends" })).toEqual([castle]);
    expect(await ids({ text: "giants" })).toEqual([castle]);
    expect(await ids({ text: "castle", category: "personal" })).toEqual([]);
  });

  test("filters by category, theme, and age suitability", async () => {
    const users = await setupUsers();
    const young = await publish(users, { title: "A", category: "folktale", ageRange: "6+", themes: ["sea"] });
    const middle = await publish(users, { title: "B", category: "folktale", ageRange: "8+", themes: ["forest"] });
    const older = await publish(users, { title: "C", category: "place", ageRange: "10+", themes: ["sea"] });

    const ids = async (args: Record<string, string>) =>
      new Set((await users.t.query(api.discover.search, args)).map((s) => s._id));
    expect(await ids({})).toEqual(new Set([young, middle, older]));
    expect(await ids({ category: "folktale" })).toEqual(new Set([young, middle]));
    expect(await ids({ theme: "sea" })).toEqual(new Set([young, older]));
    // "For ages 8+" means suitable for an 8-year-old: 6+ and 8+, not 10+.
    expect(await ids({ ageRange: "8+" })).toEqual(new Set([young, middle]));
    expect(await ids({ ageRange: "6+", theme: "sea" })).toEqual(new Set([young]));
  });

  test("old stories without a category or age still appear, but not under category or age filters", async () => {
    const users = await setupUsers();
    // A story written before categories existed: no category, age, themes, or source.
    const legacy = await users.t.run(async (ctx) =>
      ctx.db.insert("stories", {
        title: "Old story",
        body: "…",
        authorId: await ctx.db.insert("users", { email: "old@example.com" }),
        status: "approved",
        approvedAt: 1,
      }),
    );
    expect((await users.t.query(api.discover.search, {})).map((s) => s._id)).toEqual([legacy]);
    expect(await users.t.query(api.discover.search, { category: "folktale" })).toEqual([]);
    expect(await users.t.query(api.discover.search, { ageRange: "10+" })).toEqual([]);
    expect((await users.t.query(api.discover.home, {})).categories).toEqual([]);
  });
});

describe("home sections", () => {
  test("category shelves hold only published stories of that category, and empty ones are left out", async () => {
    const users = await setupUsers();
    const legend = await publish(users, { category: "local_legend" });
    await users.author.mutation(api.stories.submit, {
      title: "Pending",
      body: "…",
      category: "personal",
      ageRange: "6+",
      themes: [],
      source: { kind: "personal" },
    });

    const { categories, seasonal } = await users.t.query(api.discover.home, {});
    expect(categories.map((c) => c.category)).toEqual(["local_legend"]);
    expect(categories[0].stories.map((s) => s._id)).toEqual([legend]);
    expect(seasonal).toEqual([]);
  });

  test("Seasonal Stories is curated by admins only, newest addition first", async () => {
    const users = await setupUsers();
    const first = await publish(users);
    const second = await publish(users);

    await expect(users.author.mutation(api.discover.setSeasonal, { storyId: first, featured: true })).rejects.toThrow(
      "Only admins",
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    await users.admin.mutation(api.discover.setSeasonal, { storyId: first, featured: true });
    vi.setSystemTime(2_000);
    await users.admin.mutation(api.discover.setSeasonal, { storyId: second, featured: true });
    expect((await users.t.query(api.discover.home, {})).seasonal.map((s) => s._id)).toEqual([second, first]);

    await users.admin.mutation(api.discover.setSeasonal, { storyId: second, featured: false });
    expect((await users.t.query(api.discover.home, {})).seasonal.map((s) => s._id)).toEqual([first]);
    expect(await users.admin.query(api.discover.isSeasonal, { storyId: first })).toBe(true);
    expect(await users.reader.query(api.discover.isSeasonal, { storyId: first })).toBeNull();
  });

  test("Stories Near You returns nearby published stories, nearest first", async () => {
    const users = await setupUsers();
    const near = await publish(users, { location: lisbon });
    await publish(users, { location: porto });
    await publish(users);

    const result = await users.t.query(api.discover.nearby, { here: inLisbon });
    expect(result.map((s) => s._id)).toEqual([near]);
    expect(result[0].distanceKm).toBeLessThan(2);
  });
});

describe("Top Picks", () => {
  test("is empty without any signals, rather than showing random stories", async () => {
    const users = await setupUsers();
    await publish(users);
    expect(await users.reader.query(api.discover.topPicks, {})).toEqual([]);
    expect(await users.t.query(api.discover.topPicks, {})).toEqual([]);
  });

  test("recommends nearby stories and stories sharing themes the reader explored, with reasons", async () => {
    const users = await setupUsers();
    const opened = await publish(users, { title: "Opened", themes: ["sea"], category: "place" });
    const sameTheme = await publish(users, { title: "Sea", themes: ["sea"], category: "personal" });
    const sameCategory = await publish(users, { title: "Place", themes: [], category: "place" });
    const nearby = await publish(users, { title: "Near", location: lisbon, category: "personal" });
    await publish(users, { title: "Unrelated", themes: ["giants"], category: "folktale" });

    await users.reader.mutation(api.library.recordView, { storyId: opened });

    const picks = await users.reader.query(api.discover.topPicks, { here: inLisbon });
    expect(Object.fromEntries(picks.map((p) => [p._id, p.reason]))).toEqual({
      [nearby]: "Near you",
      [sameTheme]: "Because you explored Sea",
      [sameCategory]: "More Stories of a Place",
    });
    // Already opened stories aren't recommended again.
    expect(picks.map((p) => p._id)).not.toContain(opened);
  });

  test("respects the reader's chosen age range", async () => {
    const users = await setupUsers();
    const opened = await publish(users, { themes: ["forest"] });
    const forYoung = await publish(users, { themes: ["forest"], ageRange: "6+" });
    await publish(users, { themes: ["forest"], ageRange: "10+" });

    await users.reader.mutation(api.library.recordView, { storyId: opened });
    await users.reader.mutation(api.users.setAgeRange, { ageRange: "8+" });

    const picks = await users.reader.query(api.discover.topPicks, {});
    expect(picks.map((p) => p._id)).toEqual([forYoung]);
  });
});
