import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Circle, Popup, useMapEvents } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PageHeader } from '../components/PageHeader'
import { BaseMap, StoryPin, type LatLng } from '../components/StoryMap'
import { EUROPEAN_LEGENDS } from '../data/europeanLegends'
import { byline } from '../format'
import { precisionNote } from '../location'
import { useMapStatus } from '../mapStatus'
import { dotColor, MAP_CATEGORIES, MAP_DATA_SOURCE, mapCategory, type MapCategory, type MapStory } from '../mapStories'

// Opened from Home's "See them on the map": /map?lat=…&lng=…&r=<km>&label=…
function useFocusArea() {
  const [params] = useSearchParams()
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const radiusKm = Number(params.get('r'))
  if (!params.has('lat') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null
  const r = Number.isFinite(radiusKm) && radiusKm > 0 ? Math.min(radiusKm, 300) : 50
  return { center: { lat, lng }, radiusKm: r, label: params.get('label') || 'this area' }
}

function zoomForRadius(km: number) {
  return km <= 15 ? 12 : km <= 30 ? 11 : km <= 60 ? 10 : km <= 120 ? 9 : km <= 200 ? 8 : 7
}

// The real published stories, in the map's simple shape.
function useLiveStories(): MapStory[] | undefined {
  const mapped = useQuery(api.stories.mapped, MAP_DATA_SOURCE === 'live' ? {} : 'skip')
  return mapped?.map((story) => ({
    id: story._id,
    title: story.title,
    category: mapCategory(story.category),
    latitude: story.location.lat,
    longitude: story.location.lng,
    status: 'published',
    shortDescription: [byline(story.author), story.location.place].filter(Boolean).join(' · '),
    locationType: story.location.precision ?? 'exact',
    href: `/story/${story._id}`,
  }))
}

// The story map: every published story that's connected to a place, as a small coloured dot.
export default function MapPage() {
  const live = useLiveStories()
  // European legends in development (see MAP_DATA_SOURCE), the app's stories otherwise.
  const all = MAP_DATA_SOURCE === 'legends' ? EUROPEAN_LEGENDS : live
  // Only published stories go on the map. Category visibility is separate UI state.
  const stories = all?.filter((story) => story.status === 'published')
  const [hiddenCategories, setHiddenCategories] = useState<Set<MapCategory>>(new Set())
  const visible = stories?.filter((story) => !story.category || !hiddenCategories.has(story.category))
  const focus = useFocusArea()

  return (
    <div>
      <PageHeader
        title="Map"
        hideTitle
        subtitle={
          stories === undefined
            ? 'Loading stories…'
            : stories.length === 0
              ? 'No published stories are connected to a place yet.'
              : 'Drag and zoom to explore. Tap a dot to see its story.'
        }
      />
      {focus && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-stone-800 ring-1 ring-orange-200">
          <span>
            Showing stories within {focus.radiusKm} km of <strong>{focus.label}</strong>.
          </span>
          <Link to="/map" className="font-semibold text-orange-800 underline">
            Show all stories
          </Link>
        </p>
      )}
      <CategoryFilter
        hidden={hiddenCategories}
        onToggle={(category) =>
          setHiddenCategories((prev) => {
            const next = new Set(prev)
            if (next.has(category)) next.delete(category)
            else next.add(category)
            return next
          })
        }
      />
      {/* Tall enough to explore on a phone while leaving room for the heading and the tab bar.
          Keyed on the focus so switching between an area and all stories re-frames the map. The map
          waits for the stories so it opens already framed around them, instead of showing the whole
          world and then jumping. */}
      <div className="relative">
      {!focus && stories === undefined ? (
        <div className="flex h-[calc(100dvh-15rem)] min-h-80 items-center justify-center rounded-lg border border-stone-300 bg-stone-100 text-sm text-stone-500 md:h-[36rem]">
          Loading the map…
        </div>
      ) : (
      <BaseMap
        key={focus ? `${focus.center.lat},${focus.center.lng},${focus.radiusKm}` : 'all'}
        {...(focus
          ? { center: focus.center, zoom: zoomForRadius(focus.radiusKm) }
          : startingView(stories?.map((s) => ({ lat: s.latitude, lng: s.longitude })) ?? []))}
        className="h-[calc(100dvh-15rem)] min-h-80 md:h-[36rem]"
      >
        {focus && (
          <Circle
            center={focus.center}
            radius={focus.radiusKm * 1000}
            pathOptions={{ color: '#ea580c', weight: 1.5, dashArray: '6 6', fillColor: '#fb923c', fillOpacity: 0.06 }}
            interactive={false}
          />
        )}
        <ReportPosition label={focus?.label} />
        {visible?.map((story) => (
          <StoryPin
            key={story.id}
            center={{ lat: story.latitude, lng: story.longitude }}
            color={dotColor(story.category)}
            title={story.title}
          >
            <Popup>
              <p className="!m-0 font-serif text-base font-semibold leading-snug">{story.title}</p>
              {story.category && (
                <p className="!mb-0 !mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: dotColor(story.category) }}
                  />
                  {MAP_CATEGORIES.find((c) => c.id === story.category)?.label}
                </p>
              )}
              {story.place && <p className="!mb-0 !mt-1 text-xs font-medium text-stone-700">{story.place}</p>}
              <p className="!mb-0 !mt-1 text-stone-600">{story.shortDescription}</p>
              {precisionNote(story.locationType) && (
                <p className="!m-0 text-xs text-stone-500">{precisionNote(story.locationType)}</p>
              )}
              {story.href ? (
                <Link
                  to={story.href}
                  className="mt-2 inline-block rounded-full bg-orange-600 px-3.5 py-1.5 text-sm font-semibold !text-white no-underline hover:bg-orange-700"
                >
                  Open story
                </Link>
              ) : story.source ? (
                <p className="!mb-0 !mt-2 text-xs text-stone-500">
                  Source:{' '}
                  <a
                    href={story.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold !text-orange-700 underline-offset-2 hover:underline"
                  >
                    {story.source.author ? `${story.source.author.split(' (')[0].split(',')[0]}, ` : ''}
                    {story.source.title}
                    {story.source.date ? ` (${story.source.date.split(' (')[0]})` : ''} ↗
                  </a>
                </p>
              ) : null}
            </Popup>
          </StoryPin>
        ))}
      </BaseMap>
      )}
      </div>
    </div>
  )
}

// A lightweight control above the map: one chip per category, with the same pastel dot as on the map.
// All on by default; tapping one hides or shows its stories.
function CategoryFilter({ hidden, onToggle }: { hidden: Set<MapCategory>; onToggle: (category: MapCategory) => void }) {
  return (
    <div role="group" aria-label="Show story types" className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-1">
      {MAP_CATEGORIES.map(({ id, label, color }) => {
        const shown = !hidden.has(id)
        return (
          <button
            key={id}
            type="button"
            aria-pressed={shown}
            onClick={() => onToggle(id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
              shown ? 'border-stone-300 bg-white text-stone-800 hover:border-stone-500' : 'border-stone-200 bg-transparent text-stone-400'
            }`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              // Off: a pale grey dot, so it reads as switched off.
              style={{ background: shown ? color : 'rgb(214 211 209)' }}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// Sends the map's live centre, zoom, and scale to the strip above the header while the map moves.
function ReportPosition({ label }: { label?: string }) {
  const { setStatus } = useMapStatus()
  const map = useMapEvents({
    move: () => report(),
    zoom: () => report(),
  })
  function report() {
    const { lat, lng } = map.getCenter().wrap()
    const zoom = map.getZoom()
    // Web Mercator: metres per pixel at this latitude and zoom.
    const metersPerPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8)
    setStatus({ lat, lng, zoom, metersPerPixel, label })
  }
  useEffect(() => {
    map.whenReady(report)
    return () => setStatus(null)
    // report reads the map each time; run once per map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, label])
  return null
}


// Where the map opens with no area chosen: framed around all stories, close in on a single story,
// or the whole world when there are none yet.
function startingView(points: LatLng[]) {
  if (points.length === 0) return { center: [20, 0] as [number, number], zoom: 2 }
  if (points.length === 1) return { center: points[0], zoom: 9 }
  return { bounds: points.map((p) => [p.lat, p.lng] as [number, number]) }
}
