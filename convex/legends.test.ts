import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { oneScene, setupUsers } from "./test.setup";

// convex-test doesn't record a stored file's type, so set it as an upload would.
async function storeImage(t: Awaited<ReturnType<typeof setupUsers>>["t"]) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["picture"], { type: "image/png" }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(id, { contentType: "image/png" });
    return id;
  });
}

const legend = (title: string) => ({
  importId: "legend-1",
  story: {
    title,
    scenes: oneScene("A giant was thrown from the rock where the castle now stands."),
    cover: { kind: "colors" as const },
    location: { lat: 50.14, lng: 8.39, place: "Burg Eppstein, Germany", precision: "exact" as const },
    category: "legend" as const,
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

test("a legend's picture becomes its cover and illustration, and importing again keeps it", async () => {
  const { t } = await setupUsers();
  await t.mutation(internal.legends.importLegends, { legends: [legend("The Giant")] });
  const picture = await storeImage(t);
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: picture, alt: "Two dancers", credit: "FPO" });

  const [card] = await t.query(api.discover.search, { text: "Giant" });
  const story = await t.query(api.stories.get, { id: card.code! });
  expect(story?.cover).toMatchObject({ kind: "image", storageId: picture, alt: "Two dancers" });
  expect(story?.scenes[0].illustrations).toMatchObject([{ storageId: picture, alt: "Two dancers", credit: "FPO" }]);

  await t.mutation(internal.legends.importLegends, { legends: [legend("The Giant of Eppstein")] });
  const again = await t.query(api.stories.get, { id: card.code! });
  expect(again?.title).toBe("The Giant of Eppstein");
  expect(again?.cover).toMatchObject({ kind: "image", storageId: picture });
  expect(again?.scenes[0].illustrations).toHaveLength(1);

  // A new picture replaces the old one, whose file is deleted.
  const next = await storeImage(t);
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: next, alt: "Sleepers" });
  expect(await t.run(async (ctx) => await ctx.db.system.get("_storage", picture))).toBeNull();
});
