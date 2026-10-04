import { useQuery } from 'convex/react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { CATEGORIES, type StoryCategory } from '../../convex/taxonomy'
import { StoryCard } from '../components/StoryCard'
import { placeHeading, useSelectedPlace } from '../selectedPlace'

// "See all" for the chosen place: every story there, or every story in one category.
export default function PlaceAll() {
  const { category = 'all' } = useParams()
  const { place } = useSelectedPlace()
  const known = CATEGORIES.find((c) => c.value === category)
  const stories = useQuery(
    api.discover.nearby,
    place
      ? { here: place.center, radiusKm: place.radiusKm, limit: 100, category: known?.value as StoryCategory | undefined }
      : 'skip',
  )

  // Without a chosen place there's nothing to list; start from the beginning.
  if (!place) return <Navigate to="/" replace />

  const where = placeHeading(place).replace(/^Stories /, '')
  const shown = stories

  return (
    <div>
      <Link to="/" className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← {placeHeading(place)}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        {known ? `${known.label} ${where}` : `All stories ${where}`}
      </h1>
      {shown === undefined ? (
        <p className="mt-6 text-stone-500">Loading stories…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-stone-600">No stories here yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((story) => (
            <StoryCard
              key={story._id}
              story={story}
              wide
              note={`${story.distanceKm < 1 ? 'Under 1 km' : `${Math.round(story.distanceKm)} km`} away`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
