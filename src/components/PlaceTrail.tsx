import type { Map as LeafletMap } from 'leaflet'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Precision } from '../location'
import { placeParts, zoomToPart } from '../placeTrail'

// A story's place line where each part zooms the map to it, from the spot outward:
// "Old Town Hall, Brno, Czechia": Old Town Hall → the story's spot; Brno → the city; Czechia → the
// country, each at the zoom for its kind of place (see placeZoom.ts). On the map's story sheet the
// parts are buttons that move that map (`map`), and clicking one closes the sheet so the place is in
// view. On the story page they're links to the Map tab (`linkTo`), which does the same zoom there.
export function PlaceTrail({
  place,
  at,
  precision,
  map,
  onZoom,
  linkTo,
}: {
  place: string
  at: { lat: number; lng: number }
  precision?: Precision
  map?: LeafletMap | null
  // Called when a part is clicked, e.g. to close the story's sheet so the place is in view.
  onZoom?: () => void
  // Instead of moving a map on this page: the address of the Map tab zoomed to part `i`.
  linkTo?: (i: number) => string
}) {
  const parts = placeParts(place)
  const [busy, setBusy] = useState<number | null>(null)
  const linkClass = 'underline decoration-stone-300 underline-offset-2 hover:text-stone-950 hover:decoration-stone-700'
  const title = (i: number) => (i === 0 ? `Show the story's place on the map` : `Show ${parts[i]} on the map`)

  async function zoomTo(i: number) {
    if (!map) return
    // The popup or sheet steps aside so the place it zooms to can be seen.
    map.closePopup()
    onZoom?.()
    setBusy(i)
    await zoomToPart(map, parts, i, at, precision)
    setBusy(null)
  }

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          {linkTo ? (
            <Link to={linkTo(i)} title={title(i)} className={linkClass}>
              {part}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void zoomTo(i)}
              title={title(i)}
              className={`${linkClass} ${busy === i ? 'cursor-wait opacity-60' : ''}`}
            >
              {part}
            </button>
          )}
        </Fragment>
      ))}
    </>
  )
}
