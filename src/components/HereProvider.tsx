import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { LatLng } from '../../convex/geo'
import { HereContext, type HereStatus } from '../here'

const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined

export function HereProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HereStatus>(geolocation ? 'checking' : 'unavailable')
  const [position, setPosition] = useState<LatLng | null>(null)

  const request = useCallback(() => {
    if (!geolocation) return
    setStatus('locating')
    geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to ~1 km: enough to find nearby stories, and keeps queries stable as GPS jitters.
        const round = (n: number) => Math.round(n * 100) / 100
        setPosition({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) })
        setStatus('granted')
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { maximumAge: 5 * 60_000, timeout: 15_000 },
    )
  }, [])

  // If the reader already allowed location for this site, use it without asking again.
  useEffect(() => {
    if (!geolocation) return
    let cancelled = false
    const permissions = navigator.permissions?.query({ name: 'geolocation' })
    if (!permissions) {
      queueMicrotask(() => !cancelled && setStatus('prompt'))
      return
    }
    permissions
      .then((p) => {
        if (cancelled) return
        if (p.state === 'granted') request()
        else setStatus(p.state === 'denied' ? 'denied' : 'prompt')
      })
      .catch(() => !cancelled && setStatus('prompt'))
    return () => {
      cancelled = true
    }
  }, [request])

  return <HereContext.Provider value={{ status, position, request }}>{children}</HereContext.Provider>
}
