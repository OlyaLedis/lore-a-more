import { divIcon, type DivIcon, type LatLngBoundsExpression, type LatLngExpression, type Map as LeafletMap } from 'leaflet'
import { useEffect, useState, type ReactNode } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { zoomFor, type Precision } from '../location'
import { BASE_MAP, storyPlaceStyle, VECTOR_STYLE_URL } from '../mapStyle'
import { NEUTRAL_DOT } from '../mapStories'

export type LatLng = { lat: number; lng: number }

// One Leaflet icon per colour and size, reused by every dot.
const icons = new Map<string, DivIcon>()
function dotIcon(color: string, large: boolean) {
  const key = `${color}:${large}`
  let icon = icons.get(key)
  if (!icon) {
    icon = divIcon({
      // A 24px invisible hit area keeps small dots easy to click and tap; the dot sits in the middle.
      html: `<span class="sp-dot${large ? ' sp-dot-large' : ''}" style="color:${color}"></span>`,
      className: 'sp-dot-hit',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -6],
    })
    icons.set(key, icon)
  }
  return icon
}

// A story on the map: a small coloured dot (10.4px; 14.3px on hover; 18.2px while its story is open). No pin
// shape or symbol. `large` keeps it at the selected size, for a single story's own map or a pin being
// placed in the story form.
export function StoryPin({
  center,
  color = NEUTRAL_DOT,
  large = false,
  title,
  onSelect,
  children,
}: {
  center: LatLng
  color?: string
  // The selected size: a single story's own map, a pin being placed, or the story shown in the sheet.
  large?: boolean
  // Shown on hover and read by screen readers.
  title?: string
  // Tapped (the Map tab opens the story's sheet instead of a popup).
  onSelect?: () => void
  children?: ReactNode
}) {
  return (
    <Marker
      position={center}
      icon={dotIcon(color, large)}
      title={title}
      alt={title}
      eventHandlers={{
        click: () => onSelect?.(),
        // The selected size while this story's popup is open.
        popupopen: (e) => e.target.getElement()?.classList.add('is-selected'),
        popupclose: (e) => e.target.getElement()?.classList.remove('is-selected'),
      }}
    >
      {children}
    </Marker>
  )
}

export function BaseMap({
  center = [20, 0],
  zoom = 2,
  bounds,
  className = 'h-96',
  children,
  onMap,
}: {
  center?: LatLngExpression
  zoom?: number
  // Opens already framed around this area (instead of center/zoom), so the map never jumps.
  bounds?: LatLngBoundsExpression
  className?: string
  children?: ReactNode
  // Hands the Leaflet map to the page, for controls drawn outside it (e.g. map search).
  onMap?: (map: LeafletMap) => void
}) {
  return (
    <MapContainer
      {...(bounds ? { bounds, boundsOptions: { padding: [40, 40], maxZoom: 9 } } : { center, zoom })}
      // Like Felt: no panning above the Arctic or below Antarctica; east–west the world repeats, and
      // panning far jumps back to the same view of the main copy (worldCopyJump).
      maxBounds={WORLD}
      maxBoundsViscosity={1}
      worldCopyJump
      // Smooth zoom steps (Felt shows zooms like 1.2), so the furthest zoom can fit the world exactly.
      zoomSnap={0.1}
      className={`z-0 w-full rounded-lg border border-stone-300 ${className}`}
    >
      <OneWorld />
      {onMap && <HandOver onMap={onMap} />}
      <CalmBase />
      {children}
    </MapContainer>
  )
}

function HandOver({ onMap }: { onMap: (map: LeafletMap) => void }) {
  const map = useMap()
  useEffect(() => onMap(map), [map, onMap])
  return null
}

// The whole map, north to south; east–west it's open, since the world repeats there (three copies).
const WORLD: LatLngBoundsExpression = [
  [-85, -540],
  [85, 540],
]

// The furthest zoom out, as on Felt: the whole world from the Arctic to Antarctica fills the map's
// height. On a wide map the continents then repeat at the sides, with their story dots (see
// `worldCopies` in location.ts). Recalculated when the map changes size (e.g. turning a phone).
function OneWorld() {
  const map = useMap()
  useEffect(() => {
    const fit = () => {
      const { x, y } = map.getSize()
      if (!x || !y) return
      // The world is 256 px tall at zoom 0 and doubles with each zoom level. Rounded up to the zoom
      // step, so no empty band shows above or below it.
      const min = Math.ceil(Math.log2(y / 256) * 10) / 10
      map.setMinZoom(min)
      if (map.getZoom() < min) map.setZoom(min, { animate: false })
    }
    fit()
    map.on('resize', fit)
    return () => {
      map.off('resize', fit)
    }
  }, [map])
  return null
}

// The calm base map: drawn from the vector style with StoryPlace's colours once
// MapLibre has loaded (only map pages download it). Until then, and if it fails, the ready-made image tiles show, so the
// map is never blank.
function CalmBase() {
  const map = useMap()
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const styleUrl = VECTOR_STYLE_URL
    if (!styleUrl) return
    let cancelled = false
    let layer: { remove: () => void } | null = null
    const draw = async () => {
      try {
        const [{ maplibreGL }, { setWorkerUrl }, { default: workerUrl }, style] = await Promise.all([
          import('@maplibre/maplibre-gl-leaflet'),
          import('maplibre-gl'),
          // MapLibre draws in a background worker; point it at the bundled file, since Vite moves it.
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          fetch(styleUrl).then((res) => {
            if (!res.ok) throw new Error(`Map style failed (${res.status})`)
            return res.json()
          }),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ])
        if (cancelled) return
        setWorkerUrl(workerUrl)
        // One credit line: the style's two data sources would each add the same MapTiler credit.
        const gl = maplibreGL({ style: storyPlaceStyle(style), attributionControl: { customAttribution: BASE_MAP.attribution } })
        layer = gl.addTo(map)
        gl.getMaplibreMap().once('load', () => !cancelled && setDrawn(true))
        // Lets developers inspect the drawn map from the browser console; not in production builds.
        if (import.meta.env.DEV) {
          Object.assign(window, { storyplaceMap: gl.getMaplibreMap(), storyplaceLeaflet: map })
        }
      } catch (err) {
        console.warn('Using image tiles for the map:', err)
      }
    }
    void draw()
    return () => {
      cancelled = true
      layer?.remove()
    }
  }, [map])

  // Once MapLibre has drawn the map, the image tiles go. Until then they show.
  if (drawn) return null
  return <TileLayer url={BASE_MAP.url} attribution={BASE_MAP.attribution} />
}

// Where the form's map should look: a chosen place, or (before a pin exists) a town the author
// jumped to. The map re-frames only when `key` changes, never when the pin is nudged.
export type MapFocus = {
  key: string
  center: LatLng
  bbox?: [number, number, number, number]
  zoom: number
}

// Map for the submit form. With no pin and no focus it shows the world. When `onPick` is set,
// clicking the map places or moves the pin.
export function LocationMap({
  value,
  precision,
  focus,
  onPick,
  className = 'h-56',
}: {
  value: LatLng | null
  precision?: Precision
  focus?: MapFocus | null
  onPick?: (value: LatLng) => void
  className?: string
}) {
  return (
    <BaseMap
      center={focus?.center ?? value ?? [20, 0]}
      zoom={focus?.zoom ?? (value ? zoomFor(precision) : 2)}
      className={`${className} ${onPick ? 'cursor-crosshair' : ''}`}
    >
      {focus && <Recenter focus={focus} />}
      {onPick && <ClickToPick onPick={onPick} />}
      {value && <StoryPin center={value} color="#EA580C" large />}
    </BaseMap>
  )
}

function Recenter({ focus }: { focus: MapFocus }) {
  const map = useMap()
  useEffect(() => {
    if (focus.bbox) {
      const [w, s, e, n] = focus.bbox
      map.fitBounds([[s, w], [n, e]], { maxZoom: 14, padding: [16, 16] })
    } else {
      map.setView(focus.center, focus.zoom)
    }
    // Deliberately keyed on focus.key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.key])
  return null
}

function ClickToPick({ onPick }: { onPick: (value: LatLng) => void }) {
  useMapEvents({
    click(e) {
      // worldCopyJump lets users pan past ±180°; wrap back into range.
      const { lat, lng } = e.latlng.wrap()
      onPick({ lat, lng })
    },
  })
  return null
}
