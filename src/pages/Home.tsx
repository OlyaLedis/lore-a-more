import { useConvexAuth, useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PinIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { HeroStoryCard, Shelf, StoryCard } from '../components/StoryCard'
import { useHere } from '../here'

// Curated discovery, not the full list: each section appears only when it has stories to show.
export default function Home() {
  const { isAuthenticated } = useConvexAuth()
  const here = useHere()
  const position = here.position ?? undefined

  const home = useQuery(api.discover.home)
  const topPicks = useQuery(api.discover.topPicks, { here: position })
  const recentlyPlayed = useQuery(api.library.recentlyPlayed, isAuthenticated ? {} : 'skip')
  const placesVisited = useQuery(api.library.placesVisited, isAuthenticated ? {} : 'skip')

  const catalogEmpty = home !== undefined && home.seasonal.length === 0 && home.categories.length === 0

  return (
    <div>
      <PageHeader title="Home" />

      <NearYou />

      {topPicks && topPicks.length > 0 && (
        <Shelf title="Top Picks for You" subtitle="Chosen from where you are and what you've explored.">
          {topPicks.map((story) => (
            <StoryCard key={story._id} story={story} note={story.reason} />
          ))}
        </Shelf>
      )}

      {placesVisited && placesVisited.length > 0 && (
        <Shelf title="Places You’ve Been" seeAll="/library">
          {placesVisited.map((story) => (
            <StoryCard key={story._id} story={story} />
          ))}
        </Shelf>
      )}

      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <Shelf title="Recently Played" seeAll="/library">
          {recentlyPlayed.map((story) => (
            <StoryCard key={story._id} story={story} />
          ))}
        </Shelf>
      )}

      {home && home.seasonal.length > 0 && (
        <Shelf title="Seasonal Stories" subtitle="Picked by the StoryPlace team for this time of year.">
          {home.seasonal.map((story) => (
            <StoryCard key={story._id} story={story} />
          ))}
        </Shelf>
      )}

      {home?.categories.map(({ category, label, stories }) => (
        <Shelf key={category} title={label} seeAll={`/search?category=${category}`}>
          {stories.map((story) => (
            <StoryCard key={story._id} story={story} />
          ))}
        </Shelf>
      ))}

      {home === undefined && <p className="mt-10 text-stone-500">Loading stories…</p>}

      {catalogEmpty && (
        <section className="mt-10 rounded-3xl border border-dashed border-stone-300 p-8 text-center">
          <h2 className="font-serif text-2xl font-semibold">Stories are on their way</h2>
          <p className="mx-auto mt-2 max-w-md text-stone-600">
            Nothing has been published in these collections yet. Share a legend, a memory, or the story of a
            place you know.
          </p>
          <Link
            to="/write"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-700"
          >
            <PlusIcon className="h-4 w-4" /> Add a Story
          </Link>
        </section>
      )}

      <section className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          to="/search"
          className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400"
        >
          <SearchIcon className="h-7 w-7 text-orange-600" />
          <span>
            <span className="block font-semibold">Explore all stories</span>
            <span className="text-sm text-stone-500">Search and filter by place, category, age, or theme.</span>
          </span>
        </Link>
        <Link
          to="/map"
          className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400"
        >
          <PinIcon className="h-7 w-7 text-orange-600" />
          <span>
            <span className="block font-semibold">Story map</span>
            <span className="text-sm text-stone-500">See where stories are connected to.</span>
          </span>
        </Link>
      </section>
    </div>
  )
}

// The first card: the nearest published story, once the reader chooses to share their location.
function NearYou() {
  const here = useHere()
  const nearby = useQuery(api.discover.nearby, here.position ? { here: here.position } : 'skip')

  if (here.status === 'granted' && nearby && nearby.length > 0) {
    const [first, ...more] = nearby
    return (
      <div>
        <HeroStoryCard
          story={first}
          eyebrow="Stories Near You"
          detail={first.distanceKm < 1 ? 'less than 1 km away' : `${Math.round(first.distanceKm)} km away`}
        />
        {more.length > 0 && (
          <Shelf title="More nearby">
            {more.map((story) => (
              <StoryCard key={story._id} story={story} note={`${Math.round(story.distanceKm)} km away`} />
            ))}
          </Shelf>
        )}
      </div>
    )
  }

  let body
  if (here.status === 'granted' && nearby === undefined) {
    body = <p className="mt-2 text-white/85">Finding stories near you…</p>
  } else if (here.status === 'granted') {
    body = (
      <>
        <p className="mt-2 max-w-md text-white/85">
          No published stories are connected to places within 50 km of you yet. Know one?
        </p>
        <Link to="/write" className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 font-semibold text-stone-900">
          Add a Story
        </Link>
      </>
    )
  } else if (here.status === 'denied' || here.status === 'unavailable') {
    body = (
      <>
        <p className="mt-2 max-w-md text-white/85">
          {here.status === 'denied'
            ? "Location is turned off for StoryPlace, so we can't show stories near you. You can allow it in your browser's site settings."
            : "Your location isn't available right now."}{' '}
          You can still explore every story on the map.
        </p>
        <Link to="/map" className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 font-semibold text-stone-900">
          Open the story map
        </Link>
      </>
    )
  } else {
    body = (
      <>
        <p className="mt-2 max-w-md text-white/85">
          Share your location to find stories connected to places around you (it's never saved).
        </p>
        <button
          type="button"
          onClick={here.request}
          disabled={here.status === 'locating' || here.status === 'checking'}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-stone-900 disabled:opacity-70"
        >
          <PinIcon className="h-4 w-4" />
          {here.status === 'locating' ? 'Finding you…' : 'Show stories near me'}
        </button>
      </>
    )
  }

  return (
    <section
      aria-label="Stories Near You"
      className="relative overflow-hidden rounded-3xl bg-linear-to-br from-stone-900 via-stone-800 to-orange-900 p-6 text-white sm:p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/25" />
      <p className="relative text-sm font-semibold uppercase tracking-wide text-orange-300">Stories Near You</p>
      <div className="relative">{body}</div>
    </section>
  )
}
