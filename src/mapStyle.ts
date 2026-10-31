// Loramore's map style, in one place: every map in the app (Map tab, story pages, location picker)
// uses this base map and these pin colours.
//
// The base map is MapTiler's "Dataviz Light", drawn in the browser from its vector style (MapLibre) so
// Loramore can set a few colours itself: soft green woods and grass, grey-blue water, everything
// else calm and pale, close to Felt's look. Until that loads, or if it can't, the same style shows as
// ready-made image tiles. To use your own style, copy Dataviz Light in MapTiler's style editor (cloud.maptiler.com → Maps → Customize), adjust
// it, and set its map ID in .env.local as VITE_MAPTILER_MAP_STYLE. No code change is needed.

const KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined
// All zoom levels in this file are Leaflet's (what the position strip shows).
const CUSTOM_STYLE = import.meta.env.VITE_MAPTILER_MAP_STYLE as string | undefined
const STYLE = CUSTOM_STYLE || 'dataviz-light'

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

// The vector style the calm map is drawn from, or null without a key.
export const VECTOR_STYLE_URL = KEY ? `https://api.maptiler.com/maps/${encodeURIComponent(STYLE)}/style.json?key=${KEY}` : null

type StyleLayer = {
  id: string
  type?: string
  minzoom?: number
  filter?: unknown
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
  maxzoom?: number
}
type MapStyle = { layers: StyleLayer[]; sources: Record<string, unknown> }

// Loramore's version of the base style: the Felt-like look below. A custom MapTiler style
// (VITE_MAPTILER_MAP_STYLE) is used as it is. The drawn map stays at every zoom: no satellite photos and,
// like Felt, no contour lines.
export function storyPlaceStyle<T extends MapStyle>(style: T): T {
  return CUSTOM_STYLE ? style : storyPlaceColors(style)
}

// A calm basemap matched to Felt's (felt.com) by sampling its colours: neutral pale land with a soft
// green over countryside, clear blue-grey water, dotted grey borders, thin pink roads, small dots for
// cities, and light grey uppercase names for countries and regions. The story dots stay the
// strongest colour on the map.
const CALM = {
  land: '#ECEBE4',
  // Countryside, from the coarse global land cover. Farmland stays the plain land colour.
  grass: '#E4E8D8',
  scrub: '#E7E9DC',
  forest: '#E1E7D3',
  water: '#B3C8DB',
  // Close in (sampled from Felt at zoom 14 and 17): parks and meadows, white streets, pale buildings,
  // dotted grey footpaths, blue-grey streams, grey street names.
  park: '#D4E2C0',
  street: '#F8F8F5',
  // Buildings, with a slightly darker edge so small ones read as blocks when they first appear.
  building: '#E4E3D8',
  buildingEdge: '#DAD9CD',
  path: '#C4C1B5',
  stream: '#B2C7D9',
  streetLabel: '#9A988F',
  village: '#6E6C67',
  border: '#A9A8A4',
  region: '#C6C5C0',
  road: '#E9CAC9',
  label: '#8F8E8A',
  region_label: '#A4A39F',
  city: '#4F4E4B',
  cityDot: '#3F3E3B',
  sea: '#6E8DAB',
}

// Felt's labels are a light grotesque; Inter is the closest MapTiler serves (Noto Sans as backup).
const FONT = ['Inter Regular', 'Noto Sans Regular']
const ITALIC = ['Noto Sans Italic']

// Detail the calm map leaves out: small land uses, buildings, rail, paths and minor roads, disputed
// borders, and small or local labels. (Water shadow was a darker, offset copy under the water.)
const HIDDEN = new Set([
  'Residential',
  'Stadium',
  'Cemetery',
  'Water shadow',
  'Aeroway',
  'Tunnel outline',
  'Tunnel path',
  'Tunnel',
  'Railway tunnel',
  'Railway tunnel dash',
  'Pier',
  'Pier road',
  'Bridge',
  'Road network outline',
  'Path outline',
  'Railway',
  'Railway dash',
  'Building top',
  'Other border dash',
  'Disputed border',
  'Place labels',
])

// Labels that stay, with their colour and font: grey for countries and regions, dark for cities and
// towns, blue italic for seas.
const LABELS: Record<string, { color: string; font: string[]; spacing?: number }> = {
  'Ocean labels': { color: CALM.sea, font: ITALIC },
  'Sea labels': { color: CALM.sea, font: ITALIC },
  'Lakeline labels': { color: CALM.sea, font: ITALIC },
  'Continent labels': { color: CALM.label, font: FONT, spacing: 0.12 },
  'Country labels': { color: CALM.label, font: FONT, spacing: 0.12 },
  'State labels': { color: CALM.region_label, font: FONT, spacing: 0.12 },
  'City labels': { color: CALM.city, font: FONT },
  'Town labels': { color: CALM.village, font: FONT },
  'Village labels': { color: CALM.village, font: FONT },
  'Road labels': { color: CALM.streetLabel, font: FONT },
}

// Cities by size as you zoom in. Shared by the city names and their dots.
const CITY_FILTER = ['all', ['==', ['get', 'class'], 'city'], ['<=', ['get', 'rank'], ['step', ['zoom'], 7, 4, 10, 5, 13, 6, 16]]]

// Drops properties set to undefined, which is how a change removes one from the base style.
function defined(props: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
}

// A dotted line: tiny dashes with round ends.
const DOTTED = { 'line-cap': 'round', 'line-join': 'round' }

// Turns Dataviz Light into the calm map above. Zooms are MapLibre's here (one below Leaflet's).
function storyPlaceColors<T extends MapStyle>(style: T): T {
  const changes: Record<string, Partial<StyleLayer> & Record<string, unknown>> = {
    Background: { paint: { 'background-color': CALM.land } },
    // A soft green over the countryside from the coarse global land cover, as Felt shows it, up to
    // Leaflet zoom 10; closer in, the detailed woods take over.
    Forest: {
      maxzoom: 9,
      filter: ['match', ['get', 'class'], ['grass', 'scrub', 'forest', 'tree'], true, false],
      paint: {
        'fill-color': ['match', ['get', 'class'], 'grass', CALM.grass, 'scrub', CALM.scrub, CALM.forest],
        'fill-opacity': 1,
        'fill-antialias': false,
      },
    },
    // Closer in, like Felt: woods and meadows aren't tinted. Only parks and nature reserves (added
    // below) and sports grounds are green.
    Landcover: { minzoom: 9, maxzoom: 9 },
    // Lakes and sea. Rivers mapped as areas are drawn separately (below) so they can wait until zoomed in.
    Water: {
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'class'], 'river']],
      paint: { 'fill-color': CALM.water, 'fill-translate': [0, 0] },
    },
    // River and stream lines only once zoomed in; lakes and wide rivers show as water areas throughout.
    // Fine, pale streams.
    River: {
      minzoom: 7,
      paint: { 'line-color': CALM.stream, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 13, 0.8, 16, 1.6] },
    },
    // Roads like Felt's: thin pink lines from Leaflet zoom 6 (motorways, trunk and main roads, none
    // further out); from Leaflet zoom 10 they turn white, except motorways, which stay pink, and smaller
    // roads join (secondary and tertiary from 10, local streets from 12). No outlines.
    'Road network': {
      minzoom: 5,
      filter: [
        'all',
        ['!=', ['get', 'brunnel'], 'tunnel'],
        [
          'any',
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
          ['all', ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false], ['>=', ['zoom'], 9]],
          ['all', ['match', ['get', 'class'], ['minor', 'service'], true, false], ['>=', ['zoom'], 11]],
        ],
      ],
      paint: {
        'line-color': ['step', ['zoom'], CALM.road, 9, ['match', ['get', 'class'], 'motorway', CALM.road, CALM.street]],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          0.6,
          9,
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 1.2, 0.8],
          13,
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 3, ['secondary', 'tertiary'], 2.2, 1.4],
          16,
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 9, ['secondary', 'tertiary'], 7, 4.5],
        ],
        // Local streets start faint, as on Felt, and are fully white from Leaflet zoom 15.
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          ['match', ['get', 'class'], ['minor', 'service'], 0.45, 1],
          14,
          1,
        ],
      },
    },
    // Footpaths and tracks as fine dotted grey lines, from Leaflet zoom 16 (Felt shows none at 15).
    Path: {
      minzoom: 15,
      layout: DOTTED,
      paint: { 'line-color': CALM.path, 'line-width': 1, 'line-dasharray': [0.1, 2.5] },
    },
    'Path minor': {
      minzoom: 15,
      layout: DOTTED,
      paint: { 'line-color': CALM.path, 'line-width': 1, 'line-dasharray': [0.1, 2.5] },
    },
    // Pale buildings with no outline from Leaflet zoom 15, fading in, as on Felt.
    Building: {
      minzoom: 13.8,
      paint: {
        'fill-color': CALM.building,
        'fill-outline-color': CALM.buildingEdge,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.8, 0, 14.2, 1],
      },
    },
    // Street names from Leaflet zoom 14.
    'Road labels': { minzoom: 13, layout: { 'text-size': 11 } },
    // Dotted grey borders: countries throughout, regions (states, provinces) from Leaflet zoom 6.
    'Country border': {
      layout: DOTTED,
      paint: {
        'line-color': CALM.border,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 10, 1.6],
        'line-dasharray': [0.1, 2.2],
      },
    },
    'Other border': {
      minzoom: 5,
      maxzoom: 24,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['==', ['get', 'maritime'], 0]],
      layout: DOTTED,
      paint: { 'line-color': CALM.region, 'line-width': 1, 'line-dasharray': [0.1, 2.2] },
    },
    // Names of large regions, as Felt shows them: ranks 1–3 (German states, Austrian Länder), not
    // rank 0 (French regions) or 4 (departments, provinces). From Leaflet zoom 6 to 9.
    'State labels': {
      minzoom: 5,
      maxzoom: 9,
      filter: ['all', ['==', ['get', 'class'], 'state'], ['>=', ['get', 'rank'], 1], ['<=', ['get', 'rank'], 3]],
      layout: { 'text-size': 11 },
    },
    // City names sit beside a small dot, wherever there's room.
    'City labels': {
      filter: CITY_FILTER,
      layout: {
        'text-anchor': undefined,
        'text-offset': undefined,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.55,
        'text-justify': 'auto',
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11.5, 9, 13, 13, 16],
      },
    },
    'Town labels': { minzoom: 7 },
    // Villages (like Eppstein) once zoomed in close, from Leaflet zoom 12.
    'Village labels': { minzoom: 11 },
  }
  return {
    ...style,
    layers: style.layers.flatMap((layer) => {
      if (HIDDEN.has(layer.id)) return [{ ...layer, layout: { ...layer.layout, visibility: 'none' } }]
      const change = changes[layer.id]
      let next: StyleLayer = change
        ? { ...layer, ...change, paint: { ...layer.paint, ...change.paint }, layout: defined({ ...layer.layout, ...change.layout }) }
        : layer
      const label = LABELS[layer.id]
      if (label) {
        next = {
          ...next,
          layout: { ...next.layout, 'text-font': label.font, ...(label.spacing ? { 'text-letter-spacing': label.spacing } : {}) },
          paint: { ...next.paint, 'text-color': label.color, 'text-halo-color': CALM.land, 'text-halo-width': 1.2 },
        }
      }
      if (layer.id === 'Lakeline labels') {
        // River and stream names along their lines, blue italic as on Felt: rivers (the Rhine, the
        // Main) from Leaflet zoom 9, canals from 11, streams (the Schwarzbach) from 14.
        const riverNames = {
          id: 'StoryPlace river names',
          type: 'symbol',
          source: (layer as StyleLayer & { source?: string }).source,
          'source-layer': 'waterway',
          minzoom: 8,
          filter: [
            'all',
            ['has', 'name'],
            [
              'step',
              ['zoom'],
              ['==', ['get', 'class'], 'river'],
              10,
              ['match', ['get', 'class'], ['river', 'canal'], true, false],
              13,
              ['match', ['get', 'class'], ['river', 'canal', 'stream'], true, false],
            ],
          ],
          layout: {
            'symbol-placement': 'line',
            'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
            'text-font': ITALIC,
            'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 12.5],
            'text-letter-spacing': 0.05,
            'symbol-spacing': 400,
            'text-max-angle': 30,
          },
          paint: { 'text-color': CALM.sea, 'text-halo-color': CALM.land, 'text-halo-width': 1.2 },
        } as StyleLayer
        return [next, riverNames]
      }
      if (layer.id === 'City labels') {
        // The dot beside each city name: same cities, drawn under the names.
        const dots = {
          id: 'StoryPlace city dots',
          type: 'circle',
          source: (layer as StyleLayer & { source?: string }).source,
          'source-layer': (layer as StyleLayer & { 'source-layer'?: string })['source-layer'],
          minzoom: layer.minzoom,
          maxzoom: 9,
          filter: CITY_FILTER,
          paint: { 'circle-radius': 1.8, 'circle-color': CALM.cityDot },
        } as StyleLayer
        return [dots, next]
      }
      if (layer.id === 'Landcover') {
        // Parks and nature reserves, as Felt shows them close in: the same green as meadows.
        const source = (layer as StyleLayer & { source?: string }).source
        const parks = {
          id: 'StoryPlace parks',
          type: 'fill',
          source,
          'source-layer': 'park',
          minzoom: 9,
          paint: { 'fill-color': CALM.park, 'fill-opacity': 1, 'fill-antialias': false },
        } as StyleLayer
        // Sports grounds and playgrounds, the small green squares Felt shows close in.
        const grounds = {
          id: 'StoryPlace sports grounds',
          type: 'fill',
          source,
          'source-layer': 'landuse',
          minzoom: 13,
          filter: ['match', ['get', 'class'], ['pitch', 'playground'], true, false],
          paint: { 'fill-color': CALM.park, 'fill-opacity': 1 },
        } as StyleLayer
        return [next, parks, grounds]
      }
      if (layer.id !== 'Water') return [next]
      // Wide rivers drawn as areas read as a web of fine lines from far out; show them once zoomed in.
      const riverAreas: StyleLayer = {
        ...next,
        id: 'StoryPlace river areas',
        minzoom: 7,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'brunnel'], 'tunnel'], ['==', ['get', 'class'], 'river']],
      }
      return [next, riverAreas]
    }),
  }
}
