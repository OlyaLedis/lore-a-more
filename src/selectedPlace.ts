import { createContext, useContext } from 'react'
import type { LatLng } from '../convex/geo'

// Where the visitor chose to discover stories. "search" is a place they picked; "device" is their
// own position from Use My Location. The two are separate: one never silently replaces the other.
export type SelectedPlace = {
  source: 'search' | 'device'
  // Short name for headings, e.g. "Sardinia" or "Eppstein". "you" if a device position has no name.
  label: string
  center: LatLng
  radiusKm: number
}

export type SelectedPlaceState = {
  place: SelectedPlace | null
  choose: (place: SelectedPlace) => void
  clear: () => void
}

export const SelectedPlaceContext = createContext<SelectedPlaceState>({
  place: null,
  choose: () => {},
  clear: () => {},
})

export function useSelectedPlace() {
  return useContext(SelectedPlaceContext)
}

// "Stories in Sardinia" for a chosen place, "Stories near Eppstein" for the visitor's own position.
export function placeHeading(place: SelectedPlace) {
  if (place.source === 'device') return place.label === 'you' ? 'Stories near you' : `Stories near ${place.label}`
  return `Stories in ${place.label}`
}
