import { useConvexAuth, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { NEARBY_KM } from '../../convex/geo'
import { FindStoriesBanner, type BannerStatus, type FindTarget } from '../components/FindStoriesBanner'
import { NewIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { CardRow, FeaturedStoryCard, Section, Shelf, StoryCard, TwoCardGrid } from '../components/StoryCard'
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

      <FindStories />

      {/* Page rhythm: one featured story, rows of small cards for your history and the season,
          then two-card grids for each category. */}
      {topPicks && topPicks.length > 0 && (
        <Section title="Top Picks for You">
          <FeaturedStoryCard story={topPicks[0]} note={topPicks[0].reason} />
        </Section>
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
        <Section key={category} title={label} seeAll={`/search?category=${category}`}>
          <TwoCardGrid stories={stories} />
        </Section>
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
          to="/new"
          className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400"
        >
          <NewIcon className="h-7 w-7 text-orange-600" />
          <span>
            <span className="block font-semibold">New stories</span>
            <span className="text-sm text-stone-500">Everything recently published, newest first.</span>
          </span>
        </Link>
      </section>
    </div>
  )
}

type Finding =
  | { kind: 'none' }
  | { kind: 'place'; target: FindTarget }
  | { kind: 'text'; text: string }
  | { kind: 'location' }

// The banner and whatever it found, shown right below it.
function FindStories() {
  const here = useHere()
  const [finding, setFinding] = useState<Finding>({ kind: 'none' })
  const resultsRef = useRef<HTMLDivElement>(null)

  // Bring the results into view, which matters on a phone where they start below the fold.
  const showResults = () =>
    setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      resultsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }, 50)

  const usingLocation = finding.kind === 'location'
  const locationTarget: FindTarget | null =
    usingLocation && here.status === 'granted' && here.position
      ? { label: 'you', center: here.position, radiusKm: NEARBY_KM }
      : null

  let status: BannerStatus = null
  if (usingLocation && here.status === 'denied') {
    status = {
      tone: 'error',
      text: "Location access is turned off for StoryPlace, so we can't look around you. You can allow it in your browser's site settings, or type a place above.",
    }
  } else if (usingLocation && here.status === 'unavailable') {
    status = { tone: 'error', text: "We couldn't get your location just now. Try again, or type a place above." }
  } else if (usingLocation && here.status === 'locating') {
    status = { tone: 'info', text: 'Asking your browser for your location…' }
  }

  return (
    <div>
      <FindStoriesBanner
        onFind={(target) => {
          setFinding({ kind: 'place', target })
          showResults()
        }}
        onNoPlace={(text) => {
          setFinding({ kind: 'text', text })
          showResults()
        }}
        onUseLocation={() => {
          setFinding({ kind: 'location' })
          here.request()
          showResults()
        }}
        locating={usingLocation && here.status === 'locating'}
        status={status}
      />
      <div ref={resultsRef} className="scroll-mt-24">
        {finding.kind === 'place' && (
          <NearbyResults target={finding.target} onClear={() => setFinding({ kind: 'none' })} />
        )}
        {locationTarget && <NearbyResults target={locationTarget} onClear={() => setFinding({ kind: 'none' })} />}
        {finding.kind === 'text' && <TextResults text={finding.text} onClear={() => setFinding({ kind: 'none' })} />}
      </div>
    </div>
  )
}

function ResultsHeader({ title, subtitle, onClear }: { title: string; subtitle?: string; onClear: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClear} className="shrink-0 text-sm font-medium text-stone-600 underline hover:text-stone-900">
        Clear
      </button>
    </div>
  )
}

const emptyBox = 'mt-4 rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-6'
const pillLink = 'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold'

function NearbyResults({ target, onClear }: { target: FindTarget; onClear: () => void }) {
  const stories = useQuery(api.discover.nearby, { here: target.center, radiusKm: target.radiusKm })
  const where = target.label === 'you' ? 'you' : target.label
  const mapHref = `/map?${new URLSearchParams({
    lat: String(target.center.lat),
    lng: String(target.center.lng),
    r: String(target.radiusKm),
    label: target.label === 'you' ? 'your location' : target.label,
  })}`

  return (
    <section aria-live="polite" aria-label={`Stories near ${where}`} className="mt-8">
      <ResultsHeader
        title={`Stories near ${where}`}
        subtitle={`Within ${target.radiusKm} km${stories?.length ? ` · ${stories.length} found` : ''}`}
        onClear={onClear}
      />
      {stories === undefined ? (
        <p className="mt-4 text-stone-500">Looking for stories near {where}…</p>
      ) : stories.length === 0 ? (
        <div className={emptyBox}>
          <p className="text-stone-700">
            No published stories are connected to places within {target.radiusKm} km of {where} yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/map" className={`${pillLink} border border-stone-300 hover:border-stone-500`}>
              Explore the map
            </Link>
            <Link to="/write" className={`${pillLink} bg-orange-600 text-white hover:bg-orange-700`}>
              Add a Story from here
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <CardRow>
              {stories.map((story) => (
                <StoryCard
                  key={story._id}
                  story={story}
                  note={`${story.distanceKm < 1 ? 'Under 1 km' : `${Math.round(story.distanceKm)} km`} away`}
                />
              ))}
            </CardRow>
          </div>
          <Link to={mapHref} className={`${pillLink} mt-3 border border-stone-300 bg-white hover:border-stone-500`}>
            See them on the map
          </Link>
        </>
      )}
    </section>
  )
}

// When the text isn't a place we can find, look for stories that mention it instead.
function TextResults({ text, onClear }: { text: string; onClear: () => void }) {
  const stories = useQuery(api.discover.search, { text })
  return (
    <section aria-live="polite" aria-label={`Stories matching ${text}`} className="mt-8">
      <ResultsHeader
        title={stories?.length ? `Stories mentioning “${text}”` : `No place called “${text}”`}
        subtitle={stories?.length ? `We couldn't find a place called “${text}”, but these stories mention it.` : undefined}
        onClear={onClear}
      />
      {stories === undefined ? (
        <p className="mt-4 text-stone-500">Searching stories…</p>
      ) : stories.length === 0 ? (
        <div className={emptyBox}>
          <p className="text-stone-700">
            We couldn't find “{text}” as a place or in any story. Check the spelling, try a nearby town, or browse the map.
          </p>
          <Link to="/map" className={`${pillLink} mt-4 border border-stone-300 hover:border-stone-500`}>
            Explore the map
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <CardRow>
            {stories.map((story) => (
              <StoryCard key={story._id} story={story} />
            ))}
          </CardRow>
        </div>
      )}
    </section>
  )
}
