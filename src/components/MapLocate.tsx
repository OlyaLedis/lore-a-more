import { circle, circleMarker, layerGroup, type LayerGroup, type Map as LeafletMap } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useHere } from '../here'
import { NavigateIcon } from './Icons'

// "Locate Me" beside the place search above the map. Asks for the reader's location only when tapped
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
          ? 'Location is turned off for Loramore. You can allow it in your browser’s settings.'
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
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => void locate()}
        disabled={locating}
        aria-label="Locate Me"
        title="Locate Me"
        className="flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white/95 px-2.5 shadow-sm shadow-stone-900/5 backdrop-blur text-sm font-medium text-stone-800 hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-70 sm:px-3"
      >
        <NavigateIcon className={`h-4 w-4 ${locating ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
        {/* Icon only on narrow phones; the label is always there for screen readers. */}
        <span className="hidden sm:inline">Locate Me</span>
      </button>
      {message && (
        <p
          role="alert"
          className="absolute right-0 top-full z-[1100] mt-1 w-60 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-md shadow-stone-900/5"
        >
          {message}
        </p>
      )}
    </div>
  )
}
