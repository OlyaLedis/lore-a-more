// StoryPlace's map style, in one place: every map in the app (Map tab, story pages, location picker)
// uses this base map and these pin colours.
//
// The base map is MapTiler's "Dataviz Light", drawn in the browser from its vector style (MapLibre) so
// StoryPlace can set a few colours itself: soft green woods and grass, grey-blue water, everything
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

// Contour lines: warm brownish-grey on the pale map, faint white over satellite photos. Every line
// carries its height; index lines (nth_line 10, e.g. every 50 m) are a little stronger and labelled.
const CONTOUR = {
  calm: 'hsla(30, 22%, 38%, 0.22)',
  calmIndex: 'hsla(30, 24%, 34%, 0.45)',
  calmLabel: 'hsl(30, 18%, 38%)',
  satellite: 'hsla(0, 0%, 100%, 0.22)',
  satelliteIndex: 'hsla(0, 0%, 100%, 0.45)',
}

// StoryPlace's version of the base style: the calm look below, and (for any style) satellite
// photos when zoomed in plus contour lines so readers can see how high or low a place is.
export function storyPlaceStyle<T extends MapStyle>(style: T): T {
  const base = CUSTOM_STYLE ? style : storyPlaceColors(style)
  if (!KEY) return base
  // MapLibre runs one zoom level below Leaflet (512 px vs 256 px tiles); zooms here are in Leaflet's terms.
  const z = (leafletZoom: number) => leafletZoom - 1
  const onSatellite = (calm: string, satellite: string) => ['step', ['zoom'], calm, z(SATELLITE_FROM_ZOOM), satellite]
  const isIndex = ['>=', ['get', 'nth_line'], 5]
  const font =
    (base.layers.find((l) => l.type === 'symbol' && l.layout?.['text-font'])?.layout?.['text-font'] as string[] | undefined) ??
    ['Noto Sans Regular']

  const added: StyleLayer[] = [
    // Satellite photos replace the drawn map from town level; contours and names stay on top.
    { id: 'StoryPlace satellite', type: 'raster', source: 'storyplace-satellite', minzoom: z(SATELLITE_FROM_ZOOM) } as StyleLayer,
    // Index lines (e.g. every 50 m) from the first zoom contours exist; minor lines once zoomed in.
    {
      id: 'StoryPlace contours',
      type: 'line',
      source: 'storyplace-contours',
      'source-layer': 'contour',
      filter: isIndex,
      paint: { 'line-color': onSatellite(CONTOUR.calmIndex, CONTOUR.satelliteIndex), 'line-width': 0.9 },
    } as StyleLayer,
    {
      id: 'StoryPlace minor contours',
      type: 'line',
      source: 'storyplace-contours',
      'source-layer': 'contour',
      minzoom: z(11),
      filter: ['!', isIndex],
      paint: { 'line-color': onSatellite(CONTOUR.calm, CONTOUR.satellite), 'line-width': 0.5 },
    } as StyleLayer,
    {
      id: 'StoryPlace contour heights',
      type: 'symbol',
      source: 'storyplace-contours',
      'source-layer': 'contour',
      minzoom: z(12),
      filter: ['==', ['get', 'nth_line'], 10],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'height']], ' m'],
        'text-font': font,
        'text-size': 10,
        'symbol-spacing': 320,
      },
      paint: {
        'text-color': onSatellite(CONTOUR.calmLabel, 'hsl(0, 0%, 100%)'),
        'text-halo-color': onSatellite('hsl(40, 20%, 97%)', 'hsla(0, 0%, 0%, 0.55)'),
        'text-halo-width': 1.2,
      },
    } as StyleLayer,
  ]

  // Below the place names, above everything else.
  const firstLabel = base.layers.findIndex((l) => l.type === 'symbol')
  const at = firstLabel === -1 ? base.layers.length : firstLabel
  return {
    ...base,
    sources: {
      ...base.sources,
      'storyplace-satellite': { type: 'raster', url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${KEY}`, tileSize: 512 },
      'storyplace-contours': { type: 'vector', url: `https://api.maptiler.com/tiles/contours-v2/tiles.json?key=${KEY}` },
    },
    layers: [...base.layers.slice(0, at), ...added, ...base.layers.slice(at)],
  }
}

// A calm, editorial basemap: land, green space, water, a few major roads, and a few labels, so the
// story markers are the main thing on the map.
const CALM = {
  land: '#F7F5EF',
  green: '#DDE8D8',
  water: '#DCE7EC',
  road: '#D9D6CF',
  label: '#77736D',
}

// Detail the calm map leaves out: small land uses, buildings, rail, paths and minor roads, borders,
// and small or local labels. (Water shadow was a darker, offset copy under the water.)
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
  'Path minor',
  'Path',
  'Railway',
  'Railway dash',
  'Building',
  'Building top',
  'Other border',
  'Other border dash',
  'Disputed border',
  'Country border',
  'Lakeline labels',
  'Road labels',
  'Place labels',
  'Village labels',
  'Town labels',
])

// Labels that stay: oceans and seas, continents, countries, larger regions, and larger cities.
const KEPT_LABELS = new Set(['Ocean labels', 'Sea labels', 'Continent labels', 'Country labels', 'State labels', 'City labels'])

// Turns Dataviz Light into the calm map above. Zooms are MapLibre's here (one below Leaflet's).
function storyPlaceColors<T extends MapStyle>(style: T): T {
  const changes: Record<string, Partial<StyleLayer> & Record<string, unknown>> = {
    Background: { paint: { 'background-color': CALM.land } },
    // One soft green for woods. Zoomed out, only the coarse global forest shapes show, so there's no
    // speckled texture of small patches; the detailed woods take over when zoomed in.
    // Only large forests, not scattered tree cover, which reads as speckle.
    Forest: { maxzoom: 7, filter: ['==', ['get', 'class'], 'forest'], paint: { 'fill-color': CALM.green, 'fill-opacity': 1 } },
    Landcover: {
      minzoom: 7,
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': CALM.green, 'fill-opacity': 1, 'fill-antialias': false },
    },
    // Lakes and sea. Rivers mapped as areas are drawn separately (below) so they can wait until zoomed in.
    Water: {
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'class'], 'river']],
      paint: { 'fill-color': CALM.water, 'fill-translate': [0, 0] },
    },
    // River and stream lines only once zoomed in; lakes and wide rivers show as water areas throughout.
    River: { minzoom: 7, paint: { 'line-color': CALM.water } },
    // Only motorways, as hairline, low-contrast lines, and only from the 50 km scale (Leaflet zoom 7):
    // further out the motorway network reads as a web of fine lines.
    'Road network': {
      minzoom: 6,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['==', ['get', 'class'], 'motorway']],
      paint: {
        'line-color': CALM.road,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 10, 0.7, 14, 1.1],
        'line-opacity': 0.8,
      },
    },
    // Fewer city names: only the larger ones.
    'City labels': { filter: ['all', ['==', ['get', 'class'], 'city'], ['<=', ['get', 'rank'], 4]] },
  }
  return {
    ...style,
    layers: style.layers.flatMap((layer) => {
      if (HIDDEN.has(layer.id)) return [{ ...layer, layout: { ...layer.layout, visibility: 'none' } }]
      const change = changes[layer.id]
      let next: StyleLayer = change ? { ...layer, ...change, paint: { ...layer.paint, ...change.paint } } : layer
      if (KEPT_LABELS.has(layer.id)) {
        next = { ...next, paint: { ...next.paint, 'text-color': CALM.label, 'text-halo-color': CALM.land, 'text-halo-width': 1.2 } }
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

// From zoom 8 (where the scale bar reads about 20 km at StoryPlace's latitudes) the map switches to
// satellite photos, so readers and authors can see the actual hills, coast, castle, or cave. Needs the
// MapTiler key.
export const SATELLITE_FROM_ZOOM = 8
export const SATELLITE_MAP = KEY
  ? {
      url: `https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}{r}.jpg?key=${KEY}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ${OSM_CREDIT}`,
    }
  : null
