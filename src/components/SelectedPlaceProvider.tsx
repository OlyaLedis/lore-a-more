import { useCallback, useState, type ReactNode } from 'react'
import { SelectedPlaceContext, type SelectedPlace } from '../selectedPlace'

const KEY = 'storyplace.place'

// Kept for this browser tab only (sessionStorage), so it survives going to sign in and back, and a
// fresh visit starts at the "Discover Local Stories" screen.
function load(): SelectedPlace | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as SelectedPlace | null
    const ok =
      saved &&
      (saved.source === 'search' || saved.source === 'device') &&
      typeof saved.label === 'string' &&
      Number.isFinite(saved.center?.lat) &&
      Number.isFinite(saved.center?.lng) &&
      Number.isFinite(saved.radiusKm)
    return ok ? saved : null
  } catch {
    return null
  }
}

export function SelectedPlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<SelectedPlace | null>(load)

  const choose = useCallback((next: SelectedPlace) => {
    setPlace(next)
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Not remembered across reloads; the choice still works for now.
    }
  }, [])

  const clear = useCallback(() => {
    setPlace(null)
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // Nothing to clear.
    }
  }, [])

  return <SelectedPlaceContext.Provider value={{ place, choose, clear }}>{children}</SelectedPlaceContext.Provider>
}
