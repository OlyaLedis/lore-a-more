import { useCallback, useState, type ReactNode } from 'react'
import type { LatLng } from '../../convex/geo'
import { HereContext, type HereResult, type HereStatus } from '../here'

const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined

export function HereProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HereStatus>(geolocation ? 'idle' : 'unavailable')
  const [position, setPosition] = useState<LatLng | null>(null)

  const request = useCallback(
    () =>
      new Promise<HereResult>((resolve) => {
        if (!geolocation) {
          setStatus('unavailable')
          return resolve({ error: 'unavailable' })
        }
        setStatus('locating')
        geolocation.getCurrentPosition(
          (pos) => {
            // Rounded to ~1 km: enough to find nearby stories, and keeps queries stable as GPS jitters.
            const round = (n: number) => Math.round(n * 100) / 100
            const here = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }
            setPosition(here)
            setStatus('granted')
            resolve({ position: here })
          },
          (err) => {
            const error = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
            setStatus(error)
            resolve({ error })
          },
          { maximumAge: 5 * 60_000, timeout: 15_000 },
        )
      }),
    [],
  )

  return <HereContext.Provider value={{ status, position, request }}>{children}</HereContext.Provider>
}
