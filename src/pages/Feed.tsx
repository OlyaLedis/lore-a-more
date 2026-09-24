import { usePaginatedQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { byline, formatDate } from '../format'

export default function Feed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.stories.list,
    {},
    { initialNumItems: 10 },
  )

  if (status === 'LoadingFirstPage') {
    return <p className="text-stone-500">Loading stories…</p>
  }

  if (results.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">No stories yet.</p>
        <Link to="/new" className="mt-2 inline-block font-medium underline">
          Be the first to write one
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-stone-200">
        {results.map((story) => (
          <li key={story._id}>
            <Link to={`/story/${story._id}`} className="group block py-6">
              <h2 className="font-serif text-xl font-semibold group-hover:underline">
                {story.title}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {byline(story.author)} · {formatDate(story.approvedAt ?? story._creationTime)}
              </p>
              <p className="mt-3 line-clamp-3 text-stone-700">{story.body}</p>
            </Link>
          </li>
        ))}
      </ul>
      {status === 'CanLoadMore' && (
        <button
          onClick={() => loadMore(10)}
          className="mt-6 w-full rounded-lg border border-stone-300 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Load more
        </button>
      )}
      {status === 'LoadingMore' && <p className="mt-6 text-center text-stone-500">Loading…</p>}
    </div>
  )
}
