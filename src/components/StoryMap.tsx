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

// Map for the submit form. With no value it shows the world (the manual fallback); otherwise it
// centres on the chosen place. When `onPick` is set, clicking the map moves the pin.
export function LocationMap({
  value,
  precision,
  bbox,
  viewKey,
  onPick,
  className = 'h-56',
}: {
  value: LatLng | null
  precision?: Precision
  bbox?: [number, number, number, number]
  viewKey?: string
  onPick?: (value: LatLng) => void
  className?: string
}) {
  return (
    <BaseMap
      center={value ?? [20, 0]}
      zoom={value ? zoomFor(precision) : 2}
      className={`${className} ${onPick ? 'cursor-crosshair' : ''}`}
    >
      {value && <Recenter viewKey={viewKey} center={value} bbox={bbox} precision={precision} />}
      {onPick && <ClickToPick onPick={onPick} />}
      {value && <StoryPin center={value} precision={precision} />}
    </BaseMap>
  )
}

// Re-frames the map only when a different place is chosen, not when the pin is nudged.
function Recenter({
  viewKey,
  center,
  bbox,
  precision,
}: {
  viewKey?: string
  center: LatLng
  bbox?: [number, number, number, number]
  precision?: Precision
}) {
  const map = useMap()
  useEffect(() => {
    if (bbox) {
      const [w, s, e, n] = bbox
      map.fitBounds([[s, w], [n, e]], { maxZoom: 14, padding: [16, 16] })
    } else {
      map.setView(center, zoomFor(precision))
    }
    // Deliberately keyed on viewKey only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])
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
