// StoryPlace's map style, in one place: every map in the app (Map tab, story pages, location picker)
// uses this base map and these pin colours.
//
// The base map is MapTiler's "Dataviz Light": calm and pale, close to Felt's look, so the coloured
// story pins stand out. To use your own style, copy Dataviz Light in MapTiler's style editor (cloud.maptiler.com → Maps → Customize), adjust
// it, and set its map ID in .env.local as VITE_MAPTILER_MAP_STYLE. No code change is needed.
import type { StoryCategory } from '../convex/taxonomy'

const KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined
const STYLE = (import.meta.env.VITE_MAPTILER_MAP_STYLE as string | undefined) || 'dataviz-light'

const OSM_CREDIT = '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'

export const BASE_MAP = KEY
  ? {
      // {r} asks for sharper @2x tiles on high-resolution screens.
      url: `https://api.maptiler.com/maps/${encodeURIComponent(STYLE)}/256/{z}/{x}/{y}{r}.png?key=${KEY}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ${OSM_CREDIT}`,
    }
  : {
      // Without a MapTiler key, maps still work with OpenStreetMap's standard tiles.
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: OSM_CREDIT,
    }

// Zoomed in close (town level and nearer), the map switches to satellite photos with place names,
// so readers and authors can see the actual castle, cave, or hillside. Needs the MapTiler key.
export const SATELLITE_FROM_ZOOM = 11
export const SATELLITE_MAP = KEY
  ? {
      url: `https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}{r}.jpg?key=${KEY}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ${OSM_CREDIT}`,
    }
  : null

// Pins share the card covers' category colours. Places without a category (older stories, or the
// pin being placed in the story form) use StoryPlace orange.
export const PIN_COLORS: Record<StoryCategory | 'none', string> = {
  local_legend: '#7c3aed',
  personal: '#e11d48',
  place: '#0d9488',
  folktale: '#ea580c',
  none: '#ea580c',
}
