import { useState, type ReactNode } from 'react'
import { formatLat, formatLng, MapStatusContext, scaleBar, useMapStatus, type MapStatus } from '../mapStatus'

export function MapStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MapStatus | null>(null)
  return <MapStatusContext.Provider value={{ status, setStatus }}>{children}</MapStatusContext.Provider>
}

// A thin dark strip of map readouts above the header, in the spirit of Felt's: coordinates and zoom
// on the left, the place and a scale bar on the right. Only shown when there's a place to describe.
export function MapStatusBar() {
  const { status } = useMapStatus()
  if (!status) return null
  const scale = status.metersPerPixel ? scaleBar(status.metersPerPixel) : null

  return (
    <div
      aria-label="Map position"
      className="bg-stone-900 font-mono text-[11px] leading-none tracking-wider text-stone-100 sm:text-xs"
    >
      <div className="mx-auto flex h-7 max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
        <dl className="flex min-w-0 items-center gap-5 sm:gap-8">
          <Readout label="LAT" value={formatLat(status.lat)} />
          <Readout label="LON" value={formatLng(status.lng)} />
          {status.zoom !== undefined && <Readout label="ZOOM" value={status.zoom.toFixed(1)} className="hidden sm:flex" />}
        </dl>
        <div className="hidden min-w-0 items-center gap-6 sm:flex">
          {status.label && <Readout label="PLACE" value={status.label} truncate />}
          {scale && (
            <span className="flex shrink-0 items-center gap-2 text-stone-300">
              {/* Felt-style scale bar: alternating blocks. */}
              <span aria-hidden className="flex h-2 border border-stone-400" style={{ width: scale.px }}>
                <span className="w-1/4 bg-stone-400" />
                <span className="w-1/4" />
                <span className="w-1/4 bg-stone-400" />
                <span className="w-1/4" />
              </span>
              <span>{scale.label}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Readout({ label, value, className = 'flex', truncate = false }: { label: string; value: string; className?: string; truncate?: boolean }) {
  return (
    <div className={`${className} min-w-0 items-center gap-2`}>
      <dt className="shrink-0 text-stone-400">{label}</dt>
      <dd className={`text-stone-100 ${truncate ? 'max-w-48 truncate' : 'whitespace-nowrap'}`}>{value}</dd>
    </div>
  )
}
