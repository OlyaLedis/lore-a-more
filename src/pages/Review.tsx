import { useMutation, usePaginatedQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { byline, formatDate } from '../format'

export default function Review() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.stories.pending,
    {},
    { initialNumItems: 10 },
  )

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Review submissions</h1>
      <p className="mt-2 text-stone-500">Approved stories go live in the feed right away.</p>
      {status === 'LoadingFirstPage' ? (
        <p className="mt-6 text-stone-500">Loading…</p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-stone-500">Nothing waiting for review. 🎉</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {results.map((story) => (
            <PendingStory key={story._id} story={story} />
          ))}
        </ul>
      )}
      {status === 'CanLoadMore' && (
        <button
          onClick={() => loadMore(10)}
          className="mt-6 w-full rounded-lg border border-stone-300 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Load more
        </button>
      )}
    </div>
  )
}

function PendingStory({ story }: { story: Doc<'stories'> }) {
  const review = useMutation(api.stories.review)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true)
    setError(null)
    try {
      await review({ id: story._id, decision })
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="font-serif text-xl font-semibold">{story.title}</h2>
      <p className="mt-1 text-sm text-stone-500">
        {byline(story.author)} · submitted {formatDate(story._creationTime)}
      </p>
      <div
        className={`mt-4 whitespace-pre-wrap font-serif leading-relaxed text-stone-800 ${expanded ? '' : 'line-clamp-6'}`}
      >
        {story.body}
      </div>
      <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-stone-600 underline">
        {expanded ? 'Show less' : 'Read full story'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => decide('approved')}
          disabled={busy}
          className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide('rejected')}
          disabled={busy}
          className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </li>
  )
}
