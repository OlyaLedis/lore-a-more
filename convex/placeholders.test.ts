// Placeholder tiles: stories without a picture borrow another story's tile, marked as a placeholder,
// and the shared file survives when one of those stories gets a drawing of its own.
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { StoryCover } from "./covers";
import { oneScene, setupUsers } from "./test.setup";

type T = Awaited<ReturnType<typeof setupUsers>>["t"];

async function storeImage(t: T) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["picture"], { type: "image/png" }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(id, { contentType: "image/png" });
    return id;
  });
}

const legend = (n: number, lat: number) => ({
  importId: `legend-${n}`,
  story: {
    title: `Legend ${n}`,
    scenes: oneScene("Something happened here long ago."),
    cover: { kind: "colors" as const },
    location: { lat, lng: 8.4, place: "Somewhere, Germany", precision: "area" as const },
    category: "legend" as const,
    ageRange: "8+" as const,
    themes: [],
    source: { kind: "reference" as const, detail: "A book" },
  },
});

const covers = (t: T) =>
  t.run(async (ctx) =>
    Object.fromEntries((await ctx.db.query("stories").collect()).map((s) => [s.importId ?? "", s.cover])) as Record<string, StoryCover | undefined>,
  );

test("stories without a tile borrow one in turn, marked as placeholders; own tiles stay", async () => {
  const { t } = await setupUsers();
  // Two with tiles of their own, far apart; three without, far from each other too.
  await t.mutation(internal.legends.importLegends, { legends: [1, 2, 3, 4, 5].map((n) => legend(n, 40 + n * 2)) });
  const [a, b] = [await storeImage(t), await storeImage(t)];
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: a, alt: "A", use: "cover" });
  await t.mutation(internal.legends.setPicture, { importId: "legend-2", storageId: b, alt: "B", use: "cover" });

  const plan = await t.mutation(internal.covers.fillPlaceholders, { skip: [], apartKm: 30, dryRun: false });
  expect(plan).toHaveLength(3);
  // Never the same tile twice in a row.
  expect(plan[0].tileFrom).not.toBe(plan[1].tileFrom);
  expect(plan[1].tileFrom).not.toBe(plan[2].tileFrom);

  const after = await covers(t);
  expect(after["legend-1"]).toMatchObject({ storageId: a, alt: "A" });
  expect(after["legend-1"]).not.toHaveProperty("placeholder");
  for (const n of [3, 4, 5]) expect(after[`legend-${n}`]).toMatchObject({ kind: "image", placeholder: true });

  // Importing the legends again keeps the placeholders marked.
  await t.mutation(internal.legends.importLegends, { legends: [1, 2, 3, 4, 5].map((n) => legend(n, 40 + n * 2)) });
  for (const n of [3, 4, 5]) expect((await covers(t))[`legend-${n}`]).toMatchObject({ placeholder: true });

  // Running it again changes nothing: every story has a tile now.
  expect(await t.mutation(internal.covers.fillPlaceholders, { skip: [], apartKm: 30, dryRun: false })).toEqual([]);
});

test("a skipped tile isn't reused, and a near neighbour gets a different one", async () => {
  const { t } = await setupUsers();
  // Legend 3 sits next to legend 1 (same place), legend 4 is far away.
  await t.mutation(internal.legends.importLegends, { legends: [legend(1, 50), legend(2, 44), legend(3, 50), legend(4, 60), legend(9, 30)] });
  const [a, b, fpo] = [await storeImage(t), await storeImage(t), await storeImage(t)];
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: a, alt: "A", use: "cover" });
  await t.mutation(internal.legends.setPicture, { importId: "legend-2", storageId: b, alt: "B", use: "cover" });
  await t.mutation(internal.legends.setPicture, { importId: "legend-9", storageId: fpo, alt: "Book", use: "cover" });

  await t.mutation(internal.covers.fillPlaceholders, { skip: ["legend-9"], apartKm: 30, dryRun: false });
  const after = await covers(t);
  const files = Object.values(after).map((c) => (c?.kind === "image" ? c.storageId : null));
  expect(files.filter((f) => f === fpo)).toHaveLength(1);
  expect(after["legend-3"]).toMatchObject({ storageId: b, placeholder: true });
});

test("a shared tile's file stays when one story gets its own drawing", async () => {
  const { t } = await setupUsers();
  await t.mutation(internal.legends.importLegends, { legends: [legend(1, 40), legend(2, 50)] });
  const shared = await storeImage(t);
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: shared, alt: "A", use: "cover" });
  await t.mutation(internal.covers.fillPlaceholders, { skip: [], apartKm: 30, dryRun: false });

  // Legend 2's placeholder is replaced by a drawing of its own: legend 1 still shows the shared file.
  const own = await storeImage(t);
  await t.mutation(internal.legends.setPicture, { importId: "legend-2", storageId: own, alt: "Own", use: "cover" });
  const after = await covers(t);
  expect(after["legend-2"]).toMatchObject({ storageId: own });
  expect(after["legend-2"]).not.toHaveProperty("placeholder");
  expect(await t.run((ctx) => ctx.db.system.get("_storage", shared))).not.toBeNull();

  // And when legend 1 changes its own tile too, nobody uses the file, so it's deleted.
  await t.mutation(internal.legends.setPicture, { importId: "legend-1", storageId: await storeImage(t), alt: "New", use: "cover" });
  expect(await t.run((ctx) => ctx.db.system.get("_storage", shared))).toBeNull();
});
