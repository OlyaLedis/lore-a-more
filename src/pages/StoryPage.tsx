import { useQuery } from 'convex/react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { StatusBadge } from '../components/StatusBadge'
import { byline, formatDate } from '../format'

export default function StoryPage() {
  const { id = '' } = useParams()
  const story = useQuery(api.stories.get, { id })

  if (story === undefined) return <p className="text-stone-500">Loading…</p>
  if (story === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">This story doesn't exist.</p>
        <Link to="/" className="mt-2 inline-block font-medium underline">
          Back to all stories
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/" className="text-sm text-stone-500 hover:text-stone-900">
        ← All stories
      </Link>
      {story.status !== 'approved' && (
        <div className="mt-4">
          <StatusBadge status={story.status} />
        </div>
      )}
      <h1 className="mt-4 font-serif text-4xl font-bold leading-tight">{story.title}</h1>
      <p className="mt-2 text-stone-500">
        {byline(story.author)} · {formatDate(story.approvedAt ?? story._creationTime)}
      </p>
      <div className="prose prose-stone prose-lg mt-8 max-w-none whitespace-pre-wrap font-serif">
        {story.body}
      </div>
    </article>
  )
}
