import type { PlaceResult } from './geocoding'

export type Precision = 'exact' | 'area' | 'uncertain'

export const PRECISION_OPTIONS: { value: Precision; label: string; hint: string }[] = [
  { value: 'exact', label: 'Exact location', hint: 'The pin marks the very spot, such as a castle or cave.' },
  {
    value: 'area',
    label: 'Approximate area',
    hint: 'Somewhere around the pin, such as a town, valley, or plateau.',
  },
  { value: 'uncertain', label: 'Uncertain', hint: 'Tradition or memory places it roughly here.' },
]

// Shown next to a story's place. Older stories have no precision and get no note.
export function precisionNote(precision: Precision | undefined) {
  switch (precision) {
    case 'exact':
      return 'Exact location'
    case 'area':
      return 'Approximate area, not an exact site'
    case 'uncertain':
      return 'Location uncertain'
    default:
      return null
  }
}

export function zoomFor(precision: Precision | undefined) {
  return precision === 'exact' ? 13 : precision === 'area' ? 10 : precision === 'uncertain' ? 8 : 6
}

// The location being entered on the submit form, before it's sent.
export type LocationDraft = {
  // Changes when a new place is chosen, so the preview map re-centres only then.
  key: string
  place: string
  lat: number
  lng: number
  bbox?: [number, number, number, number]
  precision: Precision
  // True when the search result itself is a specific spot (a landmark, peak, address).
  pointLike: boolean
  // True once the user has placed the pin themselves.
  adjusted: boolean
}

export function draftFromPlace(p: PlaceResult): LocationDraft {
  return {
    key: p.id,
    place: p.label,
    lat: p.lat,
    lng: p.lng,
    bbox: p.bbox,
    precision: p.pointLike ? 'exact' : 'area',
    pointLike: p.pointLike,
    adjusted: false,
  }
}

// A town's or region's center must not be passed off as the exact site of an event.
export function locationProblem(d: LocationDraft | null) {
  if (d && d.precision === 'exact' && !d.pointLike && !d.adjusted) {
    return 'You marked this as an exact location, but the pin is at the center of the search result. Use “Adjust location on map” to put it on the spot, or choose “Approximate area”.'
  }
  return null
}

// A saved location, for the edit form. The saved pin is what the author confirmed, so it counts as
// placed by hand. Stories pinned before precision existed start as "area" until the author says otherwise.
export function draftFromSaved(loc: { lat: number; lng: number; place?: string; precision?: Precision }): LocationDraft {
  return {
    key: `saved-${loc.lat},${loc.lng}`,
    place: loc.place ?? '',
    lat: loc.lat,
    lng: loc.lng,
    precision: loc.precision ?? 'area',
    pointLike: false,
    adjusted: true,
  }
}

export function toSubmitLocation(d: LocationDraft | null) {
  if (!d) return undefined
  return { lat: d.lat, lng: d.lng, place: d.place.trim() || undefined, precision: d.precision }
}

// Opens the story's spot in Google Maps (its own app on phones), for directions or a closer look.
// Uses the pin's coordinates, not the place name, so it lands on the same spot as our map.
export function googleMapsUrl({ lat, lng }: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`
}

// A point in each copy of the world (west, main, east), so story dots also appear where the world
// repeats at the sides when the map is zoomed far out, as on Felt.
export function worldCopies({ lat, lng }: { lat: number; lng: number }) {
  return [-360, 0, 360].map((shift) => ({ lat, lng: lng + shift }))
}

// A place handed to the story form in its address:
// /write?place=Eppstein%2C+Hesse%2C+Germany&lat=50.14&lng=8.39&spot=0. `spot=1` means a specific spot
// (a castle, an address), which may be marked exact; otherwise it's a town or area.
export function draftFromParams(params: URLSearchParams): LocationDraft | null {
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const place = (params.get('place') ?? '').trim().slice(0, 120)
  if (!params.has('lat') || !params.has('lng') || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  const pointLike = params.get('spot') === '1'
  return {
    key: `link-${lat},${lng}`,
    place,
    lat,
    lng,
    precision: pointLike ? 'exact' : 'area',
    pointLike,
    adjusted: false,
  }
}
