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
  // MapTiler's place types, e.g. ["country"], ["municipality"], ["poi"] (used to choose a zoom).
  types: string[]
  // Its Wikidata item, e.g. "Q45347", if MapTiler knows it.
  wikidata?: string
}

type Feature = {
  id: string
  text: string
  place_name: string
  place_type: string[]
  place_type_name?: string[]
  center: [number, number]
  bbox?: [number, number, number, number]
  properties?: { categories?: string[]; wikidata?: string }
}

// `near` ranks places close to that point first (e.g. the map's centre), as Felt's search does.
export async function searchPlaces(
  query: string,
  signal: AbortSignal,
  near?: { lat: number; lng: number },
  // Only these MapTiler place types, e.g. "country"; all of them by default.
  types: string = SEARCH_TYPES,
): Promise<PlaceResult[]> {
  if (!KEY) throw new Error('VITE_MAPTILER_KEY is not set')
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`)
  url.searchParams.set('key', KEY)
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('limit', '8')
  url.searchParams.set('types', types)
  if (near) url.searchParams.set('proximity', `${near.lng.toFixed(4)},${near.lat.toFixed(4)}`)
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
    types: f.place_type,
    wikidata: f.properties?.wikidata,
  }
}

function humanize(s: string) {
  const words = s.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Reverse geocoding returns one feature per place type; prefer the town, then smaller or larger areas.
const AREA_TYPES = ['municipality', 'municipal_district', 'locality', 'place', 'county']

// The name of the town or area at a point, e.g. "Eppstein", or null if it can't be found.
export async function placeNameAt({ lat, lng }: { lat: number; lng: number }, signal: AbortSignal) {
  if (!KEY) return null
  const url = new URL(`https://api.maptiler.com/geocoding/${lng},${lat}.json`)
  url.searchParams.set('key', KEY)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`)
  const features = ((await res.json()) as { features?: Feature[] }).features ?? []
  for (const type of AREA_TYPES) {
    const match = features.find((f) => f.place_type.includes(type))
    if (match) return match.text
  }
  return null
}

// Where to centre the map on a place. For a town or other area, MapTiler gives the middle of its whole
// area (for Eppstein, the forest north of the town), so this asks Wikidata for the town's own
// coordinates, as Felt lands on the town centre. Falls back to MapTiler's point if Wikidata has none,
// it's outside the place's area, or the request fails.
export async function placeCentre(place: PlaceResult, signal: AbortSignal): Promise<{ lat: number; lng: number }> {
  const fallback = { lat: place.lat, lng: place.lng }
  if (place.pointLike || !place.wikidata || !/^Q\d+$/.test(place.wikidata)) return fallback
  try {
    const url = new URL('https://www.wikidata.org/w/api.php')
    url.search = new URLSearchParams({
      action: 'wbgetclaims',
      entity: place.wikidata,
      property: 'P625',
      format: 'json',
      origin: '*',
    }).toString()
    const res = await fetch(url, { signal })
    if (!res.ok) return fallback
    const data = (await res.json()) as {
      claims?: { P625?: { mainsnak?: { datavalue?: { value?: { latitude: number; longitude: number } } } }[] }
    }
    const value = data.claims?.P625?.[0]?.mainsnak?.datavalue?.value
    if (!value) return fallback
    const { latitude: lat, longitude: lng } = value
    if (place.bbox) {
      const [west, south, east, north] = place.bbox
      if (lat < south || lat > north || lng < west || lng > east) return fallback
    }
    return { lat, lng }
  } catch {
    return fallback
  }
}
