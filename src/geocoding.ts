// Place search via the MapTiler Geocoding API (https://docs.maptiler.com/cloud/api/geocoding/).
// The key is public by design: restrict it to your site's origins in the MapTiler dashboard.
const KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

export const geocodingEnabled = Boolean(KEY)

// Every MapTiler place type. MapTiler leaves out points of interest (`poi`: castles, caves, peaks,
// churches…) unless asked, so we list its defaults plus `poi` rather than searching POIs only.
// https://docs.maptiler.com/guides/location-services/geocoding-search/place-types-values/
const SEARCH_TYPES = [
  'continental_marine',
  'country',
  'major_landform',
  'region',
  'subregion',
  'county',
  'joint_municipality',
  'joint_submunicipality',
  'municipality',
  'municipal_district',
  'locality',
  'neighbourhood',
  'place',
  'postal_code',
  'address',
  'road',
  'poi',
].join(',')

const GENERIC_CATEGORIES = new Set(['attraction', 'building', 'regional', 'tourism'])

// Results of these types are a specific spot. Everything else (towns, regions, roads…) covers an area.
const POINT_TYPES = new Set(['poi', 'address'])

export type PlaceResult = {
  id: string
  name: string
  // The rest of the full name, e.g. "Lviv Oblast, Ukraine", to tell same-named places apart.
  context: string
  // What kind of place it is, e.g. "Peak", "Municipality".
  kind: string
  label: string
  lat: number
  lng: number
  // [west, south, east, north]
  bbox?: [number, number, number, number]
  pointLike: boolean
}

type Feature = {
  id: string
  text: string
  place_name: string
  place_type: string[]
  place_type_name?: string[]
  center: [number, number]
  bbox?: [number, number, number, number]
  properties?: { categories?: string[] }
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  if (!KEY) throw new Error('VITE_MAPTILER_KEY is not set')
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`)
  url.searchParams.set('key', KEY)
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('limit', '8')
  url.searchParams.set('types', SEARCH_TYPES)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  const data = (await res.json()) as { features?: Feature[] }
  return (data.features ?? []).map(toPlace)
}

function toPlace(f: Feature): PlaceResult {
  const [lng, lat] = f.center
  const context = f.place_name.startsWith(f.text)
    ? f.place_name.slice(f.text.length).replace(/^,\s*/, '')
    : f.place_name
  // MapTiler often lists a generic category first ("attraction, castle"); prefer the specific one.
  const categories = f.properties?.categories ?? []
  const specific = categories.find((c) => !GENERIC_CATEGORIES.has(c)) ?? categories[0]
  const kind = specific ?? f.place_type_name?.[0] ?? f.place_type[0] ?? ''
  return {
    id: f.id,
    name: f.text,
    context,
    kind: humanize(kind),
    label: f.place_name.length <= 120 ? f.place_name : f.text.slice(0, 120),
    lat,
    lng,
    bbox: f.bbox,
    pointLike: f.place_type.some((t) => POINT_TYPES.has(t)),
  }
}

function humanize(s: string) {
  const words = s.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
