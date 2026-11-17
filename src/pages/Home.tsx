import logo from '../assets/logo.svg'
import { useConvexAuth, useQuery } from 'convex/react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { NEARBY_KM } from '../../convex/geo'
import { CATEGORIES, isCurrentCategory } from '../../convex/taxonomy'
import { LocateIcon } from '../components/Icons'
import { PlaceFinder, type FindTarget } from '../components/PlaceFinder'
import { CardRow, FeaturedStoryCard, Section, StoryCard } from '../components/StoryCard'
import { placeNameAt } from '../geocoding'
import { useHere } from '../here'
import { usePlaceStatus } from '../mapStatus'
import { distanceFrom, placeHeading, useSelectedPlace, type SelectedPlace } from '../selectedPlace'

// How many stories each section shows before "See all".
const PER_SECTION = 4

// Home starts by asking where to discover stories; story cards appear only once a place is chosen.
export default function Home() {
  const { place } = useSelectedPlace()
  return place ? <PlaceStories place={place} /> : <DiscoverStart />
}

// "Eppstein, Hesse, Germany" → "Eppstein", for headings.
function shortName(label: string) {
  return label.split(',')[0].trim()
}

type Message = { tone: 'info' | 'error'; content: ReactNode } | null

// The opening screen: a heading, a place search, and Use My Location, centered. Nothing else.
function DiscoverStart() {
  const { choose } = useSelectedPlace()
  const here = useHere()
  const statusId = useId()
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  function onFind(target: FindTarget) {
    setMessage(null)
    choose({ source: 'search', label: shortName(target.label), center: target.center, radiusKm: target.radiusKm })
  }

  function onNoPlace(text: string) {
    setMessage({
      tone: 'error',
      content: (
        <>
          We couldn’t find “{text}” as a place. Check the spelling or try a nearby town, or{' '}
          <Link to={`/search?q=${encodeURIComponent(text)}`} className="font-semibold underline">
            search stories that mention it
          </Link>
          .
        </>
      ),
    })
  }

  // Asks for location only now, because the visitor tapped the button.
  async function locateMe() {
    setLocating(true)
    setMessage({ tone: 'info', content: 'Asking your browser for your location…' })
    const result = await here.request()
    if ('error' in result) {
      setLocating(false)
      setMessage({
        tone: 'error',
        content:
          result.error === 'denied'
            ? 'Location access is turned off for Loramore. You can search for a place instead, or allow location in your browser’s settings.'
            : 'We couldn’t get your location just now. Search for a place instead, or try again.',
      })
      return
    }
    setMessage({ tone: 'info', content: 'Finding the place you’re in…' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const name = await placeNameAt(result.position, controller.signal).catch(() => null)
    clearTimeout(timer)
    choose({ source: 'device', label: name ?? 'you', center: result.position, radiusKm: NEARBY_KM })
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center pb-10 text-center md:min-h-[calc(100dvh-12rem)]">
      <h1 className="mb-8 font-serif text-[1.42rem] font-normal italic leading-tight text-orange-700 sm:mb-6 sm:text-6xl">
        Discover Local Stories
      </h1>
      <img src={logo} alt="Lore-a-More" className="h-[10.5rem] w-auto sm:h-52" />
      <div className="mt-12 w-[92%] max-w-lg text-left">
        <PlaceFinder onFind={onFind} onNoPlace={onNoPlace} describedBy={statusId} />
      </div>
      <button
        type="button"
        onClick={() => void locateMe()}
        disabled={locating}
        className="mt-4 inline-flex h-12 items-center gap-2 rounded-md px-2 font-semibold text-stone-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-70"
      >
        <LocateIcon className={`h-5 w-5 text-orange-700 ${locating ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
        {locating ? 'Finding your location…' : 'Use My Location'}
      </button>
      <p
        id={statusId}
        role={message?.tone === 'error' ? 'alert' : 'status'}
        className={`mt-4 max-w-md text-sm empty:hidden ${message?.tone === 'error' ? 'text-red-700' : 'text-stone-600'}`}
      >
        {message?.content}
      </p>
    </div>
  )
}

// Stories for the chosen place: the place as the main heading, a quiet line of actions, a featured
// story, then sections with a few cards each.
function PlaceStories({ place }: { place: SelectedPlace }) {
  const { clear } = useSelectedPlace()
  const { isAuthenticated } = useConvexAuth()
  const stories = useQuery(api.discover.nearby, { here: place.center, radiusKm: place.radiusKm, limit: 100 })
  usePlaceStatus({ ...place.center, label: place.label === 'you' ? 'Your location' : place.label })
  const heading = placeHeading(place)
  const where = place.source === 'device' && place.label === 'you' ? 'you' : place.label
  const mapHref = `/map?${new URLSearchParams({
    lat: String(place.center.lat),
    lng: String(place.center.lng),
    r: String(place.radiusKm),
    label: where === 'you' ? 'your location' : where,
  })}`

  const [nearest, ...rest] = stories ?? []
  const byCategory = CATEGORIES.map(({ value, label }) => ({
    value,
    label,
    stories: rest.filter((s) => s.category === value),
  })).filter((c) => c.stories.length > 0)
  // Stories with no category yet, or a retired one.
  const uncategorized = rest.filter((s) => !isCurrentCategory(s.category))
  // Distances only when there's a clear starting point (see distanceFrom).
  const note = (km: number) => distanceFrom(place, km)

  return (
    <div>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">{heading}</h1>
      {/* A quiet line under the place: how many stories, and the two ways to go elsewhere. */}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500 sm:text-base" aria-live="polite">
        <span>
          {stories === undefined ? 'Finding stories…' : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
        </span>
        <span aria-hidden>·</span>
        <button type="button" onClick={clear} className="font-medium text-stone-700 underline-offset-2 hover:text-stone-900 hover:underline">
          Change location
        </button>
        {stories && stories.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <Link to={mapHref} className="font-medium text-stone-700 underline-offset-2 hover:text-stone-900 hover:underline">
              Show on map
            </Link>
          </>
        )}
      </p>

      {stories === undefined ? null : stories.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            No stories {place.source === 'device' ? 'near' : 'in'} {where} yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-stone-600">
            Nobody has shared a story connected to this area so far. Try another place, or browse the whole map.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={clear}
              className="rounded-full bg-stone-900 px-5 py-2.5 font-semibold text-white hover:bg-stone-700"
            >
              Search another place
            </button>
            <Link to="/map" className="rounded-full border border-stone-300 bg-white px-5 py-2.5 font-semibold hover:border-stone-500">
              Explore the map
            </Link>
            {isAuthenticated && (
              <Link to="/write" className="rounded-full border border-stone-300 bg-white px-5 py-2.5 font-semibold hover:border-stone-500">
                Add a Story
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* No heading above the featured story: it's simply the first story here. */}
          <div className="mt-5">
            <FeaturedStoryCard story={nearest} note={note(nearest.distanceKm)} />
          </div>

          {byCategory.map(({ value, label, stories: inCategory }) => (
            <Section key={value} title={label} seeAll={inCategory.length > PER_SECTION ? `/place/${value}` : undefined}>
              <CardRow>
                {inCategory.slice(0, PER_SECTION).map((story) => (
                  <StoryCard key={story._id} story={story} note={note(story.distanceKm)} />
                ))}
              </CardRow>
            </Section>
          ))}

          {uncategorized.length > 0 && (
            <Section title="More stories" seeAll={uncategorized.length > PER_SECTION ? '/place/all' : undefined}>
              <CardRow>
                {uncategorized.slice(0, PER_SECTION).map((story) => (
                  <StoryCard key={story._id} story={story} note={note(story.distanceKm)} />
                ))}
              </CardRow>
            </Section>
          )}

          {stories.length > PER_SECTION && (
            <p className="mt-10">
              <Link to="/place/all" className="font-semibold text-orange-700 hover:underline">
                See all {stories.length} stories {place.source === 'device' ? 'near' : 'in'} {where}
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}
