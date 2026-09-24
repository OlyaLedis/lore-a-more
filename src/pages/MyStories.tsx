import { usePaginatedQuery } from 'convex/react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate } from '../format'

export default function MyStories() {
  const location = useLocation()
  const justSubmitted = (location.state as { submitted?: boolean } | null)?.submitted
  const { results, status, loadMore } = usePaginatedQuery(
    api.stories.mine,
    {},
    { initialNumItems: 20 },
  )

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">My stories</h1>
      {justSubmitted && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
          Thanks! Your story was submitted and will appear in the feed once Olga approves it.
        </p>
      )}
      {status === 'LoadingFirstPage' ? (
        <p className="mt-6 text-stone-500">Loading…</p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-stone-500">
          You haven't submitted any stories yet.{' '}
          <Link to="/new" className="font-medium underline">
            Write one
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200">
          {results.map((story) => (
            <li key={story._id} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <Link to={`/story/${story._id}`} className="font-serif text-lg font-semibold hover:underline">
                  {story.title}
                </Link>
                <p className="text-sm text-stone-500">Submitted {formatDate(story._creationTime)}</p>
              </div>
              <StatusBadge status={story.status} />
            </li>
          ))}
        </ul>
      )}
      {status === 'CanLoadMore' && (
        <button
          onClick={() => loadMore(20)}
          className="mt-6 w-full rounded-lg border border-stone-300 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Load more
        </button>
      )}
    </div>
  )
}
