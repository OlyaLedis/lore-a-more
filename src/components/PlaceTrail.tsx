import type { Map as LeafletMap } from 'leaflet'
import { Fragment, useState } from 'react'
import { geocodingEnabled, placeCentre, searchPlaces, type PlaceResult } from '../geocoding'
import type { Precision } from '../location'
import { flyToView, placeView, storyZoom } from '../placeZoom'

// A story's place line where each part zooms the map to it, from the spot outward:
// "Old Town Hall, Brno, Czechia": Old Town Hall → the story's spot; Brno → the city; Czechia → the
// country, each at the zoom for its kind of place (see placeZoom.ts). The first part is the story's own pin. Wider parts are looked up by name (with the rest of
// the line, near the pin), and the map frames the result; if that fails it zooms out around the pin.
// Clicking one closes the popup, so the place is in view.
export function PlaceTrail({
  place,
  at,
  precision,
  map,
  onZoom,
}: {
  place: string
  at: { lat: number; lng: number }
  precision?: Precision
  map: LeafletMap | null
  // Called when a part is clicked, e.g. to close the story's sheet so the place is in view.
  onZoom?: () => void
}) {
  const parts = place
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const [busy, setBusy] = useState<number | null>(null)

  async function zoomTo(i: number) {
    if (!map) return
    // The popup or sheet steps aside so the place it zooms to can be seen.
    map.closePopup()
    onZoom?.()
    if (i === 0) {
      map.flyTo([at.lat, at.lng], storyZoom(precision), { duration: 0.8 })
      return
    }
    const last = i === parts.length - 1
    setBusy(i)
    const found = await lookUp(parts.slice(i).join(', '), at, last)
    setBusy(null)
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

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={() => void zoomTo(i)}
            title={i === 0 ? `Zoom to the story's place` : `Zoom to ${part}`}
            className={`underline decoration-stone-300 underline-offset-2 hover:text-stone-950 hover:decoration-stone-700 ${
              busy === i ? 'cursor-wait opacity-60' : ''
            }`}
          >
            {part}
          </button>
        </Fragment>
      ))}
    </>
  )
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
