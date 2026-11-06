import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { oneScene, setupUsers } from "./test.setup";

const legend = (importId: string, title: string) => ({
  importId,
  story: {
    title,
    scenes: oneScene("A giant was thrown from the rock where the castle now stands."),
    cover: { kind: "colors" as const },
    location: { lat: 50.14, lng: 8.39, place: "Burg Eppstein, Germany", precision: "exact" as const },
    category: "legend" as const,
    ageRange: "8+" as const,
    themes: ["giants" as const],
    source: { kind: "reference" as const, detail: "Bechstein, Die Eppsteiner, 1853" },
  },
});

const giant = {
  slug: "wild-giant-eppstein",
  name: "The wild giant of Eppstein",
  localName: "der wilde Riese",
  region: "Taunus, Germany",
  ageRange: "8+" as const,
  beliefs: ["He was a sorcerer too."],
  plots: ["He was caught in an iron net."],
  questions: ["Why did the giant feel safe?"],
  sources: ["Bechstein, Ludwig. 1853. Die Eppsteiner."],
};

async function storyId(t: Awaited<ReturnType<typeof setupUsers>>["t"], text: string) {
  const [card] = await t.query(api.discover.search, { text });
  return (await t.query(api.stories.get, { id: card.code! }))!._id;
}

test("a character card shows on its stories, and loading it again updates it and its links", async () => {
  const { t } = await setupUsers();
  await t.mutation(internal.legends.importLegends, { legends: [legend("legend-93", "The Giant"), legend("legend-94", "The Rock")] });
  const giantStory = await storyId(t, "Giant");
  const rockStory = await storyId(t, "Rock");

  expect(await t.mutation(internal.characters.importCard, { card: giant, storyImportIds: ["legend-93"] })).toEqual({ added: true, stories: 1 });
  expect(await t.query(api.characters.forStory, { storyId: giantStory })).toMatchObject([{ name: giant.name, questions: giant.questions }]);
  expect(await t.query(api.characters.forStory, { storyId: rockStory })).toEqual([]);

  await t.mutation(internal.characters.importCard, { card: { ...giant, name: "The giant" }, storyImportIds: ["legend-94"] });
  expect(await t.query(api.characters.forStory, { storyId: giantStory })).toEqual([]);
  expect(await t.query(api.characters.forStory, { storyId: rockStory })).toMatchObject([{ name: "The giant" }]);
});

test("a card needs a source and a known story", async () => {
  const { t } = await setupUsers();
  await t.mutation(internal.legends.importLegends, { legends: [legend("legend-93", "The Giant")] });
  await expect(t.mutation(internal.characters.importCard, { card: { ...giant, sources: [] }, storyImportIds: ["legend-93"] })).rejects.toThrow("source");
  await expect(t.mutation(internal.characters.importCard, { card: giant, storyImportIds: ["legend-99"] })).rejects.toThrow("legend-99");
});

test("an unpublished story shows no cards", async () => {
  const { t, author } = await setupUsers();
  const { story } = legend("x", "Mine");
  const id = await author.mutation(api.stories.submit, story);
  await t.run(async (ctx) => {
    const characterId = await ctx.db.insert("characterCards", giant);
    await ctx.db.insert("characterStories", { characterId, storyId: id });
  });
  expect(await t.query(api.characters.forStory, { storyId: id })).toEqual([]);
});
