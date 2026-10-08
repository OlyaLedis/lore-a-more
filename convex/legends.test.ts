import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { oneScene, setupUsers } from "./test.setup";

const legend = (title: string) => ({
  importId: "legend-1",
  story: {
    title,
    scenes: oneScene("A giant was thrown from the rock where the castle now stands."),
    cover: { kind: "colors" as const },
    location: { lat: 50.14, lng: 8.39, place: "Burg Eppstein, Germany", precision: "exact" as const },
    category: "local_legend" as const,
    ageRange: "8+" as const,
    themes: ["giants" as const, "castles" as const],
    source: { kind: "reference" as const, detail: "Bechstein, Die Eppsteiner, 1853", url: "http://www.zeno.org/nid/20004535227" },
  },
});

test("imported legends are published with a code; importing again updates them and keeps the code", async () => {
  const { t } = await setupUsers();
  expect(await t.mutation(internal.legends.importLegends, { legends: [legend("The Giant")] })).toEqual({ added: 1, updated: 0 });
  const [first] = await t.query(api.discover.search, { text: "Giant" });
  const story = await t.query(api.stories.get, { id: first.code! });
  expect(story).toMatchObject({ status: "approved", author: "StoryPlace", title: "The Giant" });

  expect(await t.mutation(internal.legends.importLegends, { legends: [legend("The Giant of Eppstein")] })).toEqual({ added: 0, updated: 1 });
  expect((await t.query(api.stories.get, { id: first.code! }))?.title).toBe("The Giant of Eppstein");
  expect(await t.query(api.discover.search, {})).toHaveLength(1);
});
