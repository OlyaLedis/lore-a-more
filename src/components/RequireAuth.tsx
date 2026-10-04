import { useConvexAuth, useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../../convex/_generated/api'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const location = useLocation()

  if (isLoading) return <p className="text-stone-500">Loading…</p>
  if (!isAuthenticated) {
    // Back to exactly where they were going after signing in, e.g. Add a Story.
    return <Navigate to="/signin" state={{ from: location.pathname + location.search }} replace />
  }
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me)

  if (me === undefined) return <p className="text-stone-500">Loading…</p>
  if (!me?.isAdmin) return <p className="text-stone-500">This page is for reviewers only.</p>
  return children
}
