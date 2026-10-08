// What the Map tab draws: a simple list of stories as small coloured dots, from real legends
// (src/data/europeanLegends.ts) or the app's published stories.
import type { AgeRange, StoredCategory, StoredTheme } from '../convex/taxonomy'

// From real to magical (see CATEGORIES in convex/taxonomy.ts).
export type MapCategory = 'true-tale' | 'legend' | 'wonder-tale'

// Colours for the dots, the category filter, and colour card covers, matching the Felt map's point
// styles. Dots draw them at 90% opacity with a 1px stroke in a darker shade (see .sp-dot).
// `phrase` introduces one story on its card ("A wonder tale"), in `ink`: a darker shade of the dot colour
// that reads as text.
export const MAP_CATEGORIES: { id: MapCategory; label: string; color: string; phrase: string; ink: string }[] = [
  { id: 'true-tale', label: 'True Tales', color: '#50957F', phrase: 'A true tale', ink: '#3A7360' },
  { id: 'legend', label: 'Legends', color: '#889ADD', phrase: 'A legend', ink: '#5262A6' },
  { id: 'wonder-tale', label: 'Wonder Tales', color: '#EB9360', phrase: 'A wonder tale', ink: '#A65A2E' },
]

export const CATEGORY_COLORS = Object.fromEntries(MAP_CATEGORIES.map((c) => [c.id, c.color])) as Record<MapCategory, string>

// Stories without a category (written before categories existed) and pins being placed in the form.
export const NEUTRAL_DOT = '#E7E5E4'

// Publication status is separate from the map's category filter (which is UI state).
export type MapStoryStatus = 'published' | 'draft'

export type MapStory = {
  id: string
  title: string
  category: MapCategory | null
  // Up to three topics (see THEMES in convex/taxonomy.ts).
  themes?: StoredTheme[]
  ageRange?: AgeRange
  latitude: number
  longitude: number
  status: MapStoryStatus
  shortDescription: string
  locationType: 'exact' | 'area' | 'uncertain'
  // Only the app's own stories have a page to open, and a public code (SP-…) to find them by.
  href?: string
  code?: string
  // The real place the story is anchored to, e.g. "Lorelei rock, Rhine, Germany".
  place?: string
  // Where the story comes from, for the researched legends.
  source?: StorySourceRecord
}

// Best first: folklore archives and academic collections down to Wikipedia, which is for discovery only.
export type SourceType =
  | 'folklore-archive'
  | 'heritage-institution'
  | 'museum-or-library'
  | 'municipal-heritage'
  | 'published-collection'
  | 'cultural-website'
  | 'encyclopedia'

export type StorySourceRecord = {
  title: string
  url: string
  // Author or institution, if known.
  author?: string
  // Publication or collection date, if known.
  date?: string
  type: SourceType
  // The place exactly as the source names it.
  placeNamed: string
  // How sure the story's geographic attribution is.
  confidence: 'high' | 'medium' | 'low'
}

const FROM_APP: Record<string, MapCategory> = {
  true_tale: 'true-tale',
  legend: 'legend',
  wonder_tale: 'wonder-tale',
}

// Stories still on a retired category (or none) get the neutral dot until their author chooses again.
export function mapCategory(category: StoredCategory | undefined): MapCategory | null {
  return (category && FROM_APP[category]) || null
}

export function dotColor(category: MapCategory | null) {
  return category ? CATEGORY_COLORS[category] : NEUTRAL_DOT
}

// Card covers without a picture use the same colour as the story's map dot.
export function coverColor(category: StoredCategory | undefined) {
  return dotColor(mapCategory(category))
}

// The map shows the app's published stories, which include the imported legends
// (scripts/import-legends.ts). VITE_MAP_DATA=legends shows the curated file directly instead.
export type MapData = 'legends' | 'live'
// `?.` so scripts run by Node (no Vite) can import this file too.
const MAP_DATA = import.meta.env?.VITE_MAP_DATA as string | undefined
export const MAP_DATA_SOURCE: MapData = MAP_DATA === 'legends' ? 'legends' : 'live'
