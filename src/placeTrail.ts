// The parts of a story's place line ("Old Town Hall, Brno, Czechia") and zooming a map to one of them,
// shared by PlaceTrail (the clickable line) and the Map tab (links from the story page).
import type { Map as LeafletMap } from 'leaflet'
import { geocodingEnabled, placeCentre, searchPlaces, type PlaceResult } from './geocoding'
import type { Precision } from './location'
import { flyToView, placeView, storyZoom } from './placeZoom'

export function placeParts(place: string) {
  return place
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

// Zooms the map to part `i` of a story's place line. The first part is the story's own pin. Wider parts
// are looked up by name (with the rest of the line, near the pin), and the map frames the result; if
// that fails it zooms out around the pin.
export async function zoomToPart(
  map: LeafletMap,
  parts: string[],
  i: number,
  at: { lat: number; lng: number },
  precision: Precision | undefined,
) {
  if (i === 0) {
    map.flyTo([at.lat, at.lng], storyZoom(precision), { duration: 0.8 })
    return
  }
  const last = i === parts.length - 1
  const found = await lookUp(parts.slice(i).join(', '), at, last)
  if (found) {
    // By what kind of place it is (see placeZoom.ts): a country framed whole, a town at zoom 14.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const centre = await placeCentre(found, controller.signal)
    clearTimeout(timer)
    flyToView(map, placeView(found, centre))
  } else {
    // Not found: zoom out around the story's pin instead.
    map.flyTo([at.lat, at.lng], last ? 5 : 10, { duration: 0.8 })
  }
}

// The named place around the pin: the result whose area contains the pin, else the first. The last
// part of a place line is usually the country, so that's tried as a country first.
async function lookUp(query: string, at: { lat: number; lng: number }, last: boolean): Promise<PlaceResult | null> {
  if (!geocodingEnabled) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    let results = last ? await searchPlaces(query, controller.signal, at, 'country') : []
    if (results.length === 0) results = await searchPlaces(query, controller.signal, at)
    const contains = (r: PlaceResult) => {
      if (!r.bbox) return false
      const [west, south, east, north] = r.bbox
      return at.lat >= south && at.lat <= north && at.lng >= west && at.lng <= east
    }
    return results.find(contains) ?? results[0] ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
