import { createContext, useContext, useEffect } from 'react'

// What the dark strip above the header shows: the coordinates of what the reader is looking at.
// The Map tab reports its live centre, zoom, and scale; story pages and Home report their place.
export type MapStatus = {
  lat: number
  lng: number
  zoom?: number
  // Metres per screen pixel at the centre, for the scale bar.
  metersPerPixel?: number
  label?: string
}

export const MapStatusContext = createContext<{
  status: MapStatus | null
  setStatus: (status: MapStatus | null) => void
}>({ status: null, setStatus: () => {} })

export function useMapStatus() {
  return useContext(MapStatusContext)
}

// Shows a fixed place in the strip while the calling page is open.
export function usePlaceStatus(place: { lat: number; lng: number; label?: string } | null | undefined) {
  const { setStatus } = useMapStatus()
  const lat = place?.lat
  const lng = place?.lng
  const label = place?.label
  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    setStatus({ lat, lng, label })
    return () => setStatus(null)
  }, [lat, lng, label, setStatus])
}

// "37.7929° N" style readouts.
export function formatLat(lat: number) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
}
export function formatLng(lng: number) {
  return `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`
}

// A round scale-bar length (1, 2, or 5 × 10ⁿ metres) that fits in about `maxPx` pixels.
export function scaleBar(metersPerPixel: number, maxPx = 64) {
  const maxMeters = metersPerPixel * maxPx
  const base = 10 ** Math.floor(Math.log10(maxMeters))
  const meters = [5, 2, 1].map((m) => m * base).find((m) => m <= maxMeters) ?? base
  return {
    px: Math.round(meters / metersPerPixel),
    label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
  }
}
