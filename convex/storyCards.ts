import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// What a story card needs: no body, no author account.
export function toCard(story: Doc<"stories">) {
  return {
    _id: story._id,
    title: story.title,
    author: story.author,
    category: story.category,
    ageRange: story.ageRange,
    themes: story.themes ?? [],
    place: story.location?.place,
    precision: story.location?.precision,
    hasLocation: story.location !== undefined,
    approvedAt: story.approvedAt,
  };
}

export type StoryCard = ReturnType<typeof toCard>;

// Loads stories by id for a list (saved, history, collections), keeping only published ones in order.
export async function publishedStories(ctx: QueryCtx, ids: Id<"stories">[]) {
  const stories = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return stories.filter((s): s is Doc<"stories"> => s?.status === "approved");
}
