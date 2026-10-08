import { circle, circleMarker, layerGroup, type LayerGroup, type Map as LeafletMap } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useHere } from '../here'
import { NavigateIcon } from './Icons'

// Felt-style "locate me" button under the map search. Asks for the reader's location only when tapped
// (see HereProvider: rounded to about 1 km, never stored), then flies there and marks it with a blue
// dot and a faint circle about 1 km across, since the position is only that precise.
const ZOOM = 13
const ACCURACY_M = 1000
const BLUE = '#2F6FDE'

export function MapLocate({ map }: { map: LeafletMap | null }) {
  const here = useHere()
  const [message, setMessage] = useState<string | null>(null)
  const marker = useRef<LayerGroup | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4500)
    return () => clearTimeout(timer)
  }, [message])

  // The "you are here" mark goes with the map.
  useEffect(() => () => void marker.current?.remove(), [map])

  async function locate() {
    if (!map) return
    setMessage(null)
    const result = await here.request()
    if ('error' in result) {
      setMessage(
        result.error === 'denied'
          ? 'Location is turned off for StoryPlace. You can allow it in your browser’s settings.'
          : 'We couldn’t get your location just now.',
      )
      return
    }
    const { lat, lng } = result.position
    marker.current?.remove()
    marker.current = layerGroup([
      circle([lat, lng], { radius: ACCURACY_M, color: BLUE, weight: 1, opacity: 0.35, fillOpacity: 0.08, interactive: false }),
      circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: BLUE, fillOpacity: 1, interactive: false }),
    ]).addTo(map)
    map.flyTo([lat, lng], ZOOM, { duration: 0.8 })
  }

  const locating = here.status === 'locating'
  return (
    <>
      <button
        type="button"
        onClick={() => void locate()}
        disabled={locating}
        aria-label="Show my location"
        title="Show my location"
        className="absolute right-3 top-16 z-[999] flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-900 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-70"
      >
        <NavigateIcon className={`h-5 w-5 ${locating ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
      </button>
      {message && (
        <p
          role="alert"
          className="absolute right-16 top-16 z-[999] max-w-60 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
        >
          {message}
        </p>
      )}
    </>
  )
}
