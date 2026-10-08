import { useQuery } from 'convex/react'
import type { Map as LeafletMap } from 'leaflet'
import { useEffect, useState } from 'react'
import { Circle, Popup, useMapEvents } from 'react-leaflet'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PageHeader } from '../components/PageHeader'
import { MapLocate } from '../components/MapLocate'
import { MapSearch } from '../components/MapSearch'
import { PlaceTrail } from '../components/PlaceTrail'
import { BaseMap, StoryPin } from '../components/StoryMap'
import { EUROPEAN_LEGENDS } from '../data/europeanLegends'
import { themeLabel } from '../../convex/taxonomy'
import { googleMapsUrl, precisionNote, worldCopies, writeHerePath } from '../location'
import { useMapStatus } from '../mapStatus'
import { dotColor, MAP_CATEGORIES, MAP_DATA_SOURCE, mapCategory, type MapCategory, type MapStory } from '../mapStories'
import { storyPath } from '../storyLinks'

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
    themes: story.themes,
    latitude: story.location.lat,
    longitude: story.location.lng,
    status: 'published',
    place: story.location.place,
    shortDescription: story.excerpt,
    locationType: story.location.precision ?? 'exact',
    href: storyPath(story),
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
  const [map, setMap] = useState<LeafletMap | null>(null)
  const navigate = useNavigate()

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
              : (
                  <>
                    Drag and zoom to explore. Tap a dot to see its story.{' '}
                    <Link to="/map2" className="font-medium text-stone-700 underline-offset-2 hover:underline">
                      Compare with the Felt map
                    </Link>
                  </>
                )
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
          Keyed on the focus so switching between an area and all stories re-frames the map. With no
          area chosen it opens on START_VIEW straight away; the dots appear as the stories load. */}
      <div className="relative">
      <BaseMap
        key={focus ? `${focus.center.lat},${focus.center.lng},${focus.radiusKm}` : 'all'}
        {...(focus
          ? { center: focus.center, zoom: zoomForRadius(focus.radiusKm) }
          : START_VIEW)}
        className="h-[calc(100dvh-15rem)] min-h-80 md:h-[36rem]"
        onMap={setMap}
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
        <CenterPopups />
        {visible?.flatMap((story) =>
          worldCopies({ lat: story.latitude, lng: story.longitude }).map((center) => (
            <StoryPin
              key={`${story.id}:${center.lng}`}
              center={center}
              color={dotColor(story.category)}
              title={story.title}
            >
              <Popup autoPan={false}>
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
                {story.place && (
                  <p className="!mb-0 !mt-1 text-xs">
                    <PlaceTrail
                      place={story.place}
                      at={{ lat: story.latitude, lng: story.longitude }}
                      precision={story.locationType}
                      map={map}
                    />
                  </p>
                )}
                <p className="!mb-0 !mt-1 text-stone-600">{story.shortDescription}</p>
                {story.themes && story.themes.length > 0 && (
                  <p className="!mb-0 !mt-1 text-xs text-stone-500">{story.themes.map(themeLabel).join(' · ')}</p>
                )}
                <p className="!m-0 text-xs text-stone-500">
                  {precisionNote(story.locationType) && `${precisionNote(story.locationType)} · `}
                  <a
                    href={googleMapsUrl({ lat: story.latitude, lng: story.longitude })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold !text-orange-700 underline-offset-2 hover:underline"
                  >
                    Google Maps ↗
                  </a>
                </p>
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
          )),
        )}
      </BaseMap>
      <MapLocate map={map} />
      {stories && (
        // Signed out, /write sends people to Sign In first and then back to the form with the place.
        <MapSearch map={map} stories={stories} onAddStory={(place) => navigate(writeHerePath(place))} />
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

// Every popup opens in the middle of the map: the map moves so the whole popup (and the dot it points
// at) is centred, on a phone as on a computer, instead of sliding under the buttons at the edges.
function CenterPopups() {
  const map = useMapEvents({
    popupopen: (e) => {
      // After the popup has laid out, so its height is known.
      requestAnimationFrame(() => {
        const el = e.popup.getElement()
        const at = e.popup.getLatLng()
        if (!el || !at) return
        const tip = map.latLngToContainerPoint(at)
        // The popup sits above the point it marks; centre the middle of the popup.
        const middle = tip.subtract([0, el.offsetHeight / 2 + 8])
        const size = map.getSize()
        map.panBy(middle.subtract(size.divideBy(2)), { duration: 0.4 })
      })
    },
  })
  return null
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

// Where the map opens with no area chosen: the same view as our Felt map (felt.com, loc=50.424,6.762,
// 7.38z), from Belgium to Frankfurt and Mannheim, where many of the stories are.
const START_VIEW = { center: [50.424, 6.762] as [number, number], zoom: 7.4 }
