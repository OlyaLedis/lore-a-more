import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useHere } from '../here'
import { BookmarkIcon, CheckIcon, PinIcon } from './Icons'

const button =
  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50'

// Save and Mark as visited, for signed-in readers of a published story.
export function ReaderActions({ storyId, hasPlace }: { storyId: Id<'stories'>; hasPlace: boolean }) {
  const { isAuthenticated } = useConvexAuth()
  const state = useQuery(api.library.storyState, isAuthenticated ? { storyId } : 'skip')
  const setSaved = useMutation(api.library.setSaved)
  const setVisited = useMutation(api.library.setVisited)
  const here = useHere()
  const [error, setError] = useState<string | null>(null)

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-stone-500">
        <Link to="/signin" className="font-medium text-stone-900 underline">
          Sign in
        </Link>{' '}
        to save stories and keep track of places you've been.
      </p>
    )
  }

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.')
    }
  }

  const saved = state?.saved ?? false
  const visited = state?.visited ?? null
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={saved}
          disabled={!state}
          onClick={() =>
            run(() => setSaved({ storyId, saved: !saved, here: here.position ?? undefined }))
          }
          className={`${button} ${saved ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-stone-300 bg-white hover:border-stone-500'}`}
        >
          <BookmarkIcon filled={saved} className="h-4 w-4" />
          {saved ? 'Saved' : 'Save'}
        </button>
        {hasPlace && (
          <button
            type="button"
            aria-pressed={visited !== null}
            disabled={!state}
            onClick={() => run(() => setVisited({ storyId, visited: visited === null }))}
            className={`${button} ${visited ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-stone-300 bg-white hover:border-stone-500'}`}
          >
            {visited ? <CheckIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
            {visited ? 'Visited' : 'Mark as visited'}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

// Admins add a published story to Seasonal Stories, or take it out.
export function SeasonalToggle({ storyId }: { storyId: Id<'stories'> }) {
  const featured = useQuery(api.discover.isSeasonal, { storyId })
  const setSeasonal = useMutation(api.discover.setSeasonal)
  if (featured === undefined || featured === null) return null
  return (
    <button
      type="button"
      aria-pressed={featured}
      onClick={() => void setSeasonal({ storyId, featured: !featured })}
      className={`${button} ${featured ? 'border-indigo-700 bg-indigo-50 text-indigo-800' : 'border-dashed border-stone-400 text-stone-600 hover:border-stone-600'}`}
    >
      {featured ? 'In Seasonal Stories (remove)' : 'Add to Seasonal Stories'}
    </button>
  )
}
