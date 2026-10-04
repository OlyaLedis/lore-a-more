import { createContext, useContext } from 'react'
import type { LatLng } from '../convex/geo'

// The reader's current position, shared across pages. Only requested when the reader asks
// (or silently if they already granted permission), rounded to about 1 km, and never stored.
export type HereStatus = 'checking' | 'prompt' | 'locating' | 'granted' | 'denied' | 'unavailable'

export type Here = {
  status: HereStatus
  position: LatLng | null
  request: () => void
}

export const HereContext = createContext<Here>({ status: 'unavailable', position: null, request: () => {} })

export function useHere() {
  return useContext(HereContext)
}
