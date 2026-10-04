import { useConvexAuth, useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PageHeader } from '../components/PageHeader'
import { StoryCard, type CardStory } from '../components/StoryCard'

export default function Library() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const saved = useQuery(api.library.saved, isAuthenticated ? {} : 'skip')
  const recentlyPlayed = useQuery(api.library.recentlyPlayed, isAuthenticated ? {} : 'skip')
  const placesVisited = useQuery(api.library.placesVisited, isAuthenticated ? {} : 'skip')

  if (isLoading) return <PageHeader title="Library" />

  if (!isAuthenticated) {
    return (
      <div>
        <PageHeader title="Library" />
        <div className="rounded-3xl border border-dashed border-stone-300 p-8 text-center">
          <h2 className="font-serif text-2xl font-semibold">Keep your stories in one place</h2>
          <p className="mx-auto mt-2 max-w-md text-stone-600">
            Sign in to save stories, pick up where you left off, and keep track of places you've been.
          </p>
          <Link
            to="/signin"
            state={{ from: '/library' }}
            className="mt-5 inline-block rounded-full bg-stone-900 px-5 py-2.5 font-semibold text-white hover:bg-stone-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle={
          <>
            Only you can see your library.{' '}
            <Link to="/mine" className="font-medium text-orange-700 hover:underline">
              Stories you've written
            </Link>
          </>
        }
      />
      <Section
        title="Saved Stories"
        stories={saved}
        empty="Tap Save on any story to keep it here."
      />
      <Section
        title="Recently Played"
        stories={recentlyPlayed}
        empty="Stories you open will appear here, most recent first."
      />
      <Section
        title="Places You’ve Been"
        stories={placesVisited}
        empty={
          <>
            Use <strong>Mark as visited</strong> on a story when you've been to its place. Stories you open or
            save while you're there (with location on) are added too.
          </>
        }
      />
    </div>
  )
}

function Section({ title, stories, empty }: { title: string; stories: CardStory[] | undefined; empty: ReactNode }) {
  return (
    <section className="mt-10 first-of-type:mt-0" aria-label={title}>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {stories === undefined ? (
        <p className="mt-3 text-stone-500">Loading…</p>
      ) : stories.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-stone-100 px-5 py-4 text-stone-600">{empty}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {stories.map((story) => (
            <StoryCard key={story._id} story={story} wide />
          ))}
        </div>
      )}
    </section>
  )
}
