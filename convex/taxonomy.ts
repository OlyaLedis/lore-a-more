// Story categories, ages, themes, and source kinds. Shared by the schema, server functions, and the
// frontend (no server-only imports here).
import { v, type Infer } from "convex/values";

export const storyCategory = v.union(
  v.literal("local_legend"),
  v.literal("place"),
  v.literal("folktale"),
);
export type StoryCategory = Infer<typeof storyCategory>;

// `label` names a section of many stories; `one` names the type of a single story, e.g. on a cover tag.
export const CATEGORIES: { value: StoryCategory; label: string; one: string; hint: string }[] = [
  { value: "local_legend", label: "Local Legends", one: "Local Legend", hint: "Legends told about a particular place." },
  { value: "place", label: "Stories of a Place", one: "Story of a Place", hint: "The history and life of a place." },
  { value: "folktale", label: "Folktales & Myths", one: "Folktale or Myth", hint: "Traditional tales, myths, and fairy tales." },
];

export const ageRange = v.union(v.literal("6+"), v.literal("8+"), v.literal("10+"));
export type AgeRange = Infer<typeof ageRange>;
export const AGE_RANGES: AgeRange[] = ["6+", "8+", "10+"];

// A story is suitable for a reader whose age range is the same or older.
export function suitableFor(story: AgeRange, reader: AgeRange) {
  return AGE_RANGES.indexOf(story) <= AGE_RANGES.indexOf(reader);
}

// The topics authors choose from (up to MAX_THEMES), and readers filter by.
export const storyTheme = v.union(
  // Creatures
  v.literal("dragons"),
  v.literal("giants"),
  v.literal("little_people"),
  v.literal("ghosts"),
  v.literal("animals"),
  // Characters
  v.literal("kings_knights"),
  v.literal("saints"),
  v.literal("witches"),
  v.literal("devil"),
  // What happens
  v.literal("treasure"),
  v.literal("tricks"),
  v.literal("love"),
  v.literal("battles"),
  v.literal("name_origin"),
  // Places in the story
  v.literal("castles"),
  v.literal("churches"),
  v.literal("mountains"),
  v.literal("water"),
);
export type StoryTheme = Infer<typeof storyTheme>;
export const MAX_THEMES = 3;

export const THEMES: { value: StoryTheme; label: string }[] = [
  { value: "dragons", label: "Dragons & serpents" },
  { value: "giants", label: "Giants" },
  { value: "little_people", label: "Fairies & little people" },
  { value: "ghosts", label: "Ghosts & spirits" },
  { value: "animals", label: "Animals" },
  { value: "kings_knights", label: "Kings & knights" },
  { value: "saints", label: "Saints & miracles" },
  { value: "witches", label: "Witches & magic" },
  { value: "devil", label: "The Devil" },
  { value: "treasure", label: "Treasure" },
  { value: "tricks", label: "Clever tricks" },
  { value: "love", label: "Love" },
  { value: "battles", label: "Battles & sieges" },
  { value: "name_origin", label: "How it got its name" },
  { value: "castles", label: "Castles" },
  { value: "churches", label: "Churches & monasteries" },
  { value: "mountains", label: "Mountains, caves & forests" },
  { value: "water", label: "Water" },
];

// Themes from the first list. Stories saved with them keep them (they still show, link to search, and
// match search), but new stories and edits can't choose them: the edit form leaves them out so the
// author picks current topics. They are never swapped for a guessed replacement.
export const legacyTheme = v.union(
  v.literal("sea"),
  v.literal("forest"),
  v.literal("adventure"),
  v.literal("mystery"),
  v.literal("family"),
);
export type LegacyTheme = Infer<typeof legacyTheme>;
const LEGACY_THEMES: { value: LegacyTheme; label: string }[] = [
  { value: "sea", label: "Sea" },
  { value: "forest", label: "Forest" },
  { value: "adventure", label: "Adventure" },
  { value: "mystery", label: "Mystery" },
  { value: "family", label: "Family" },
];

// Any theme a saved story can have.
export const storedTheme = v.union(storyTheme, legacyTheme);
export type StoredTheme = Infer<typeof storedTheme>;
export const STORED_THEMES: { value: StoredTheme; label: string }[] = [...THEMES, ...LEGACY_THEMES];

export function isCurrentTheme(value: StoredTheme): value is StoryTheme {
  return THEMES.some((t) => t.value === value);
}

// Where the story comes from. A retelling is a creative version, never presented as verified history.
export const storySource = v.object({
  kind: v.union(v.literal("personal"), v.literal("retelling"), v.literal("reference")),
  // Where the author heard or read it. Required for "reference".
  detail: v.optional(v.string()),
  // A web link to the source, if it's online.
  url: v.optional(v.string()),
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

export function categoryOne(value: StoryCategory) {
  return CATEGORIES.find((c) => c.value === value)?.one ?? value;
}

export function themeLabel(value: StoredTheme) {
  return STORED_THEMES.find((t) => t.value === value)?.label ?? value;
}
