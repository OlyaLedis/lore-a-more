import type { LatLngExpression, PathOptions } from 'leaflet'
import { useEffect, type ReactNode } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { zoomFor, type Precision } from '../location'

export type LatLng = { lat: number; lng: number }

// Circle markers avoid Leaflet's default PNG icons, which don't resolve through Vite.
// An exact site is a solid dot; an area or uncertain place is a wider, fainter ring so it
// doesn't read as a precise spot. Older stories (no precision) keep the solid dot.
const pinStyle: Record<Precision | 'unknown', { radius: number; style: PathOptions }> = {
  exact: { radius: 9, style: { color: '#1c1917', fillColor: '#f97316', fillOpacity: 0.9, weight: 2 } },
  unknown: { radius: 9, style: { color: '#1c1917', fillColor: '#f97316', fillOpacity: 0.9, weight: 2 } },
  area: { radius: 18, style: { color: '#c2410c', fillColor: '#f97316', fillOpacity: 0.25, weight: 2 } },
  uncertain: {
    radius: 22,
    style: { color: '#c2410c', fillColor: '#f97316', fillOpacity: 0.12, weight: 2, dashArray: '5 5' },
  },
}

export function StoryPin({
  center,
  precision,
  children,
}: {
  center: LatLng
  precision?: Precision
  children?: ReactNode
}) {
  const { radius, style } = pinStyle[precision ?? 'unknown']
  return (
    <CircleMarker center={center} radius={radius} pathOptions={style}>
      {children}
    </CircleMarker>
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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  )
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
