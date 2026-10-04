import { createContext, useContext } from 'react'
import type { LatLng } from '../convex/geo'

// The reader's current position, shared across pages. Only ever requested when the reader taps
// "Use My Location" (never on load or after signing in), rounded to about 1 km, and never stored.
export type HereStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable'

export type Here = {
  status: HereStatus
  position: LatLng | null
  // Asks the browser for the position. Resolves with it, or with why it isn't available.
  request: () => Promise<HereResult>
}

export type HereResult = { position: LatLng } | { error: 'denied' | 'unavailable' }

export const HereContext = createContext<Here>({
  status: 'unavailable',
  position: null,
  request: async () => ({ error: 'unavailable' }),
})

export function useHere() {
  return useContext(HereContext)
}
