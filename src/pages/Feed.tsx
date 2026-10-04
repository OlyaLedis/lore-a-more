import { usePaginatedQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PageHeader } from '../components/PageHeader'
import { StoryCard } from '../components/StoryCard'

// "New": every published story, most recently published first.
export default function Feed() {
  const { results, status, loadMore } = usePaginatedQuery(api.stories.list, {}, { initialNumItems: 12 })

  return (
    <div>
      <PageHeader title="New" subtitle="Recently published stories." />
      {status === 'LoadingFirstPage' ? (
        <p className="text-stone-500">Loading stories…</p>
      ) : results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 p-8 text-center">
          <p className="text-stone-600">No stories have been published yet.</p>
          <Link to="/write" className="mt-2 inline-block font-medium underline">
            Be the first to add one
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {results.map((story) => (
            <StoryCard key={story._id} story={{ ...story, place: story.location?.place }} wide />
          ))}
        </div>
      )}
      {status === 'CanLoadMore' && (
        <button
          onClick={() => loadMore(12)}
          className="mt-8 w-full rounded-full border border-stone-300 py-2.5 text-sm font-medium hover:bg-stone-100"
        >
          Load more
        </button>
      )}
      {status === 'LoadingMore' && <p className="mt-6 text-center text-stone-500">Loading…</p>}
    </div>
  )
}
