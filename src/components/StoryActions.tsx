import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { editPath } from '../storyLinks'

const linkClass = 'text-sm font-medium text-stone-600 underline hover:text-stone-900'

// Edit and Delete for the story's author. The server checks ownership again on every change.
export function StoryActions({
  id,
  code,
  onDeleted,
}: {
  id: Id<'stories'>
  code?: string
  onDeleted?: () => void
}) {
  const remove = useMutation(api.stories.remove)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await remove({ id })
      onDeleted?.()
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.')
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <div role="alertdialog" aria-label="Confirm delete" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
        <p className="text-red-900">
          Delete this story? It will be removed from the site and from your stories, along with any
          changes waiting for review. This can't be undone.
        </p>
        {error && <p className="mt-2 text-red-600">{error}</p>}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            autoFocus
            className="rounded-full bg-red-700 px-4 py-1.5 font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete story'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-full border border-stone-300 bg-white px-4 py-1.5 font-medium hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <Link to={editPath({ _id: id, code })} className={linkClass}>
        Edit
      </Link>
      <button type="button" onClick={() => setConfirming(true)} className={linkClass}>
        Delete
      </button>
    </div>
  )
}
