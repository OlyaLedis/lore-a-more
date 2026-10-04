import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { useHere } from './here'

// Adds a published story to the reader's Recently Played once per visit. If they've shared their
// location, it's sent along so opening a story at its place counts toward Places You've Been.
export function useRecordView(story: { _id: Id<'stories'>; status: string } | null | undefined) {
  const { isAuthenticated } = useConvexAuth()
  const recordView = useMutation(api.library.recordView)
  const here = useHere()
  const recorded = useRef<string | null>(null)
  const settled = here.status !== 'locating'
  const storyId = story?._id
  const approved = story?.status === 'approved'

  useEffect(() => {
    if (!storyId || !approved || !isAuthenticated || !settled) return
    if (recorded.current === storyId) return
    recorded.current = storyId
    void recordView({ storyId, here: here.position ?? undefined })
  }, [storyId, approved, isAuthenticated, settled, here.position, recordView])
}
