// What the Map tab draws: a simple list of stories as small coloured dots, from real European legends
// (src/data/europeanLegends.ts), the mock dataset (src/data/mockStories.ts), or the app's published stories.
import type { StoryCategory } from '../convex/taxonomy'

export type MapCategory = 'local-legend' | 'story-of-place' | 'folktale-myth'

// Colours for the dots and the category filter, the same on the light map and satellite.
export const MAP_CATEGORIES: { id: MapCategory; label: string; color: string }[] = [
  { id: 'local-legend', label: 'Local Legends', color: '#D991EA' },
  { id: 'story-of-place', label: 'Stories of a Place', color: '#A5EF9D' },
  { id: 'folktale-myth', label: 'Folktales & Myths', color: '#EB9568' },
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
  latitude: number
  longitude: number
  status: MapStoryStatus
  shortDescription: string
  locationType: 'exact' | 'area' | 'uncertain'
  // Only the app's own stories have a page to open.
  href?: string
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

const FROM_APP: Record<StoryCategory, MapCategory> = {
  local_legend: 'local-legend',
  place: 'story-of-place',
  folktale: 'folktale-myth',
}

export function mapCategory(category: StoryCategory | undefined): MapCategory | null {
  return category ? FROM_APP[category] : null
}

export function dotColor(category: MapCategory | null) {
  return category ? CATEGORY_COLORS[category] : NEUTRAL_DOT
}

// Card covers without a picture use the same colour as the story's map dot.
export function coverColor(category: StoryCategory | undefined) {
  return dotColor(mapCategory(category))
}

// Development shows the European legends; production shows the app's published stories.
// VITE_MAP_DATA=legends|mock|live overrides.
export type MapData = 'legends' | 'mock' | 'live'
const MAP_DATA = import.meta.env.VITE_MAP_DATA as string | undefined
export const MAP_DATA_SOURCE: MapData =
  MAP_DATA === 'legends' || MAP_DATA === 'mock' || MAP_DATA === 'live' ? MAP_DATA : import.meta.env.DEV ? 'legends' : 'live'
