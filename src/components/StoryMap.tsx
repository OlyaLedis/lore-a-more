import { divIcon, type DivIcon, type LatLngExpression } from 'leaflet'
import { useEffect, useState, type ReactNode } from 'react'
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { StoryCategory } from '../../convex/taxonomy'
import { zoomFor, type Precision } from '../location'
import { BASE_MAP, PIN_COLORS, SATELLITE_FROM_ZOOM, SATELLITE_MAP } from '../mapStyle'
import { pinHtml, type StoryType } from '../storyTypes'

export type LatLng = { lat: number; lng: number }

// One Leaflet icon per type and size, reused by every pin.
const icons = new Map<string, DivIcon>()
function pinIcon(type: StoryType, size: number) {
  const key = `${type}:${size}`
  let icon = icons.get(key)
  if (!icon) {
    icon = divIcon({
      html: pinHtml(type, size),
      className: 'sp-pin-wrap',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    })
    icons.set(key, icon)
  }
  return icon
}

// A story on the map: a round pin in its type's colour with the type's symbol (crown, tower, book,
// heart), so types are told apart without relying on colour. An approximate or uncertain place
// also gets a soft, see-through circle around a smaller pin, so it doesn't read as an exact spot.
// Older stories without a precision get the plain pin.
export function StoryPin({
  center,
  precision,
  category,
  title,
  children,
}: {
  center: LatLng
  precision?: Precision
  category?: StoryCategory
  // Shown on hover and read by screen readers.
  title?: string
  children?: ReactNode
}) {
  const type: StoryType = category ?? 'none'
  const color = PIN_COLORS[type]
  if (precision === 'area' || precision === 'uncertain') {
    const uncertain = precision === 'uncertain'
    return (
      <>
        <CircleMarker
          center={center}
          radius={uncertain ? 24 : 20}
          interactive={false}
          pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: uncertain ? 0.12 : 0.22, dashArray: uncertain ? '5 5' : undefined }}
        />
        <Marker position={center} icon={pinIcon(type, 22)} title={title} alt={title}>
          {children}
        </Marker>
      </>
    )
  }
  return (
    <Marker position={center} icon={pinIcon(type, 28)} title={title} alt={title}>
      {children}
    </Marker>
  )
}

export function BaseMap({
  center = [20, 0],
  zoom = 2,
  className = 'h-96',
  children,
}: {
  center?: LatLngExpression
  zoom?: number
  className?: string
  children?: ReactNode
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      worldCopyJump
      className={`z-0 w-full rounded-lg border border-stone-300 ${className}`}
    >
      <TileLayer url={BASE_MAP.url} attribution={BASE_MAP.attribution} />
      <SatelliteWhenClose />
      {children}
    </MapContainer>
  )
}

// Adds satellite photos on top of the calm base map once the reader zooms in to town level, and
// removes them when zooming back out. The base map stays underneath, so nothing flashes blank while
// the photos load.
function SatelliteWhenClose() {
  const [zoom, setZoom] = useState<number | null>(null)
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const current = zoom ?? map.getZoom()
  if (!SATELLITE_MAP || current < SATELLITE_FROM_ZOOM) return null
  return <TileLayer url={SATELLITE_MAP.url} attribution={SATELLITE_MAP.attribution} />
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
      {value && <StoryPin center={value} precision={precision} />}
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
