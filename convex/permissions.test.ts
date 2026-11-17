// Who may submit and publish stories: every signed-in user may submit; nothing is published until an
// admin approves it; and a pending or rejected story never reaches a public list, the map, search, a
// reader's library, or an illustrator's gallery. These rules live in the Convex functions themselves
// (requireUser / requireAdmin and status checks), so they hold whatever the app's screens show.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { baseStory, setupUsers, type TestUsers } from "./test.setup";

const here = { lat: 50.14, lng: 8.5 };
const located = {
  ...baseStory,
  title: "The Washerwoman of the Burgberg",
  location: { lat: 50.1467, lng: 8.5027, place: "Burgberg, Bad Soden am Taunus, Germany", precision: "exact" as const },
};
const page = { paginationOpts: { numItems: 20, cursor: null } };

// Every public way to find a story, as a guest sees it.
async function publiclyVisible(users: TestUsers, id: Id<"stories">) {
  const { t } = users;
  const ids = (list: { _id: Id<"stories"> }[]) => list.map((s) => s._id);
  return {
    get: (await t.query(api.stories.get, { id })) !== null,
    list: ids((await t.query(api.stories.list, page)).page).includes(id),
    map: ids(await t.query(api.stories.mapped, {})).includes(id),
    search: ids(await t.query(api.discover.search, { text: "washerwoman" })).includes(id),
    browse: ids(await t.query(api.discover.search, {})).includes(id),
    nearby: ids(await t.query(api.discover.nearby, { here, radiusKm: 20 })).includes(id),
  };
}
const hiddenEverywhere = { get: false, list: false, map: false, search: false, browse: false, nearby: false };
const shownEverywhere = { get: true, list: true, map: true, search: true, browse: true, nearby: true };

describe("story submission permissions", () => {
  test("guests can't submit; any signed-in user can, and it waits for review", async () => {
    const users = await setupUsers();
    await expect(users.t.mutation(api.stories.submit, located)).rejects.toThrow("sign in");

    // `reader` is an ordinary account: no role or invitation needed.
    const id = await users.reader.mutation(api.stories.submit, located);
    const mine = (await users.reader.query(api.stories.mine, page)).page;
    expect(mine.map((s) => [s._id, s.status])).toEqual([[id, "pending"]]);
    expect(await publiclyVisible(users, id)).toEqual(hiddenEverywhere);
    // The author and admins can open it; other readers can't.
    expect(await users.reader.query(api.stories.get, { id })).not.toBeNull();
    expect(await users.admin.query(api.stories.get, { id })).not.toBeNull();
    expect(await users.stranger.query(api.stories.get, { id })).toBeNull();
  });

  test("only admins can approve, and only then is a story public", async () => {
    const users = await setupUsers();
    const id = await users.reader.mutation(api.stories.submit, located);
    await expect(users.reader.mutation(api.stories.review, { id, decision: "approved" })).rejects.toThrow("Only admins");
    await expect(users.author.mutation(api.stories.review, { id, decision: "approved" })).rejects.toThrow("Only admins");
    await expect(users.reader.query(api.stories.pending, page)).rejects.toThrow("Only admins");
    expect(await publiclyVisible(users, id)).toEqual(hiddenEverywhere);

    await users.admin.mutation(api.stories.review, { id, decision: "approved" });
    expect(await publiclyVisible(users, id)).toEqual(shownEverywhere);
  });

  test("a rejected story stays out of every public place, and its author sees why", async () => {
    const users = await setupUsers();
    const id = await users.reader.mutation(api.stories.submit, located);
    await users.admin.mutation(api.stories.review, { id, decision: "rejected" });
    expect(await publiclyVisible(users, id)).toEqual(hiddenEverywhere);
    expect((await users.reader.query(api.stories.mine, page)).page[0].status).toBe("rejected");
  });

  test("an unpublished story can't be saved to a library or shown in an illustrator's gallery", async () => {
    const users = await setupUsers();
    const id = await users.reader.mutation(api.stories.submit, located);
    await expect(users.stranger.mutation(api.library.setSaved, { storyId: id, saved: true })).rejects.toThrow("Story not found");
    const artist = await users.admin.mutation(api.illustrators.create, { name: "Ann", links: [] });
    await users.admin.mutation(api.illustrators.setForStory, { storyId: id, illustratorIds: [artist] });
    expect((await users.t.query(api.illustrators.profile, { slug: "ann" }))?.stories).toEqual([]);
  });
});
