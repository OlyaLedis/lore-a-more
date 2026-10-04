// Story categories, ages, themes, and source kinds. Shared by the schema, server functions, and the
// frontend (no server-only imports here).
import { v, type Infer } from "convex/values";

export const storyCategory = v.union(
  v.literal("local_legend"),
  v.literal("personal"),
  v.literal("place"),
  v.literal("folktale"),
);
export type StoryCategory = Infer<typeof storyCategory>;

export const CATEGORIES: { value: StoryCategory; label: string; hint: string }[] = [
  { value: "local_legend", label: "Local Legends", hint: "Legends told about a particular place." },
  { value: "personal", label: "Personal Stories", hint: "Something that happened to you or your family." },
  { value: "place", label: "Stories of a Place", hint: "The history and life of a place." },
  { value: "folktale", label: "Folktales & Myths", hint: "Traditional tales, myths, and fairy tales." },
];

export const ageRange = v.union(v.literal("6+"), v.literal("8+"), v.literal("10+"));
export type AgeRange = Infer<typeof ageRange>;
export const AGE_RANGES: AgeRange[] = ["6+", "8+", "10+"];

// A story is suitable for a reader whose age range is the same or older.
export function suitableFor(story: AgeRange, reader: AgeRange) {
  return AGE_RANGES.indexOf(story) <= AGE_RANGES.indexOf(reader);
}

export const storyTheme = v.union(
  v.literal("castles"),
  v.literal("sea"),
  v.literal("forest"),
  v.literal("giants"),
  v.literal("animals"),
  v.literal("adventure"),
  v.literal("mystery"),
  v.literal("family"),
);
export type StoryTheme = Infer<typeof storyTheme>;
export const MAX_THEMES = 3;

export const THEMES: { value: StoryTheme; label: string }[] = [
  { value: "castles", label: "Castles" },
  { value: "sea", label: "Sea" },
  { value: "forest", label: "Forest" },
  { value: "giants", label: "Giants" },
  { value: "animals", label: "Animals" },
  { value: "adventure", label: "Adventure" },
  { value: "mystery", label: "Mystery" },
  { value: "family", label: "Family" },
];

// Where the story comes from. A retelling is a creative version, never presented as verified history.
export const storySource = v.object({
  kind: v.union(v.literal("personal"), v.literal("retelling"), v.literal("reference")),
  // Where the author heard or read it. Required for "reference".
  detail: v.optional(v.string()),
});
export type StorySource = Infer<typeof storySource>;

export const SOURCE_KINDS: { value: StorySource["kind"]; label: string; hint: string }[] = [
  { value: "personal", label: "My own story", hint: "Something I or my family lived through." },
  {
    value: "retelling",
    label: "My retelling of a traditional story",
    hint: "A creative version of a tale that's been passed on.",
  },
  { value: "reference", label: "Based on a published source", hint: "A book, archive, website, or recording." },
];

export function categoryLabel(value: StoryCategory) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function themeLabel(value: StoryTheme) {
  return THEMES.find((t) => t.value === value)?.label ?? value;
}
