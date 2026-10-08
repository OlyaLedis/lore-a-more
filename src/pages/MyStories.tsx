import { usePaginatedQuery } from 'convex/react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { RevisionBadge, StatusBadge } from '../components/StatusBadge'
import { StoryActions } from '../components/StoryActions'
import { formatDate } from '../format'
import { storyPath } from '../storyLinks'

export default function MyStories() {
  const location = useLocation()
  const { submitted, edited } = (location.state as { submitted?: boolean; edited?: boolean } | null) ?? {}
  const { results, status, loadMore } = usePaginatedQuery(
    api.stories.mine,
    {},
    { initialNumItems: 20 },
  )

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">My stories</h1>
      {submitted && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
          {edited
            ? 'Thanks! Your changes were submitted. A moderator will review them before they appear on the site.'
            : 'Thanks! Your story was submitted and will appear in the feed once a moderator approves it.'}
        </p>
      )}
      {status === 'LoadingFirstPage' ? (
        <p className="mt-6 text-stone-500">Loading…</p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-stone-500">
          You haven't submitted any stories yet.{' '}
          <Link to="/write" className="font-medium underline">
            Write one
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200">
          {results.map((story) => (
            <li key={story._id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <Link to={storyPath(story)} className="font-serif text-lg font-semibold hover:underline">
                    {story.title}
                  </Link>
                  <p className="text-sm text-stone-500">Submitted {formatDate(story._creationTime)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={story.status} />
                  <RevisionBadge status={story.revisionStatus} />
                </div>
              </div>
              <StoryActions id={story._id} code={story.code} />
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
