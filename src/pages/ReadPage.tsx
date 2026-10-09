import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ReadingView } from '../components/ReadingView'
import { useRecordView } from '../useRecordView'
import { storyKey, storyPath } from '../storyLinks'
import { previousPage } from '../backLink'

const positionKey = (id: string) => `storyplace.position.${id}`

function localPosition(id: string) {
  try {
    return localStorage.getItem(positionKey(id))
  } catch {
    return null
  }
}

// /story/:id/read — full-screen reading mode for a story.
export default function ReadPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const story = useQuery(api.stories.get, { id })
  const storyId = story?._id
  const saved = useQuery(
    api.library.readingPosition,
    storyId && isAuthenticated ? { storyId } : 'skip',
  )
  const savePosition = useMutation(api.library.saveReadingPosition)
  useRecordView(story)

  const onPosition = useCallback(
    (anchor: string) => {
      if (!storyId) return
      try {
        localStorage.setItem(positionKey(storyId), anchor)
      } catch {
        // Not remembered in this browser; the account copy below still works.
      }
      if (isAuthenticated) void savePosition({ storyId: storyId as Id<'stories'>, anchor })
    },
    [storyId, isAuthenticated, savePosition],
  )

  if (story === undefined || isLoading || (isAuthenticated && saved === undefined)) {
    return <p className="text-stone-500">Opening the story…</p>
  }
  if (story === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">This story doesn't exist.</p>
        <Link to="/" className="mt-2 inline-block font-medium underline">
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <ReadingView
      title={story.title}
      author={story.author}
      scenes={story.scenes}
      // The account's saved place wins; otherwise this browser's.
      initialAnchor={saved ?? localPosition(story._id)}
      onPosition={onPosition}
      // Back to the story page. Usually that's the page before (Read together), so go back rather than
      // add it again, or the story's back link would lead into reading mode.
      onClose={() => {
        const before = previousPage()
        if (before && !before.endsWith('/read') && before.startsWith(`/story/${storyKey(story)}`)) navigate(-1)
        else navigate(storyPath(story), { replace: true })
      }}
    />
  )
}
