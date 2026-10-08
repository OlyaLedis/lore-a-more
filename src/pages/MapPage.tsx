import { useQuery } from 'convex/react'
import type { LatLngBounds, Map as LeafletMap } from 'leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, useMapEvents } from 'react-leaflet'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { PageHeader } from '../components/PageHeader'
import { MapLocate } from '../components/MapLocate'
import { MapSearch, type ChosenPlace } from '../components/MapSearch'
import { PlaceSheet } from '../components/PlaceSheet'
import { BaseMap, StoryPin } from '../components/StoryMap'
import { StorySheet } from '../components/StorySheet'
import { EUROPEAN_LEGENDS } from '../data/europeanLegends'
import { worldCopies } from '../location'
import { placeParts, zoomToPart } from '../placeTrail'
import { storyZoom } from '../placeZoom'
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
    code: story.code,
  }))
}

// The story map: every published story that's connected to a place, as a small coloured dot.
export default function MapPage() {
  const live = useLiveStories()
  // European legends in development (see MAP_DATA_SOURCE), the app's stories otherwise.
  const all = MAP_DATA_SOURCE === 'legends' ? EUROPEAN_LEGENDS : live
  // Only published stories go on the map. Category visibility is separate UI state.
  const stories = all?.filter((story) => story.status === 'published')
  // The type tab: all stories, or one type at a time. UI state, separate from the stories.
  const [shownCategory, setShownCategory] = useState<MapCategory | 'all'>('all')
  const visible = stories?.filter((story) => shownCategory === 'all' || story.category === shownCategory)
  const focus = useFocusArea()
  const [map, setMap] = useState<LeafletMap | null>(null)
  const location = useLocation()
  // Coming back to this page (e.g. the story form's back arrow), the map opens where it was left.
  const [backView] = useState(() => mapViewOf(location.state))
  // The story shown in the sheet. Hidden by the category filter, it closes.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = visible?.find((story) => story.id === selectedId) ?? null
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  // A place chosen in the search: ringed on the map, with its card at the bottom while no story is open.
  const [place, setPlace] = useState<ChosenPlace | null>(null)
  const closePlace = useCallback(() => setPlace(null), [setPlace])
  const bounds = useMapBounds(map)
  const inView = bounds
    ? visible?.filter((s) => worldCopies({ lat: s.latitude, lng: s.longitude }).some((c) => bounds.contains(c)))
    : undefined
  useRememberView(map)
  useOpenLinkedStory({ map, stories, skip: backView !== null, onSelect: setSelectedId })

  // "Nearest" on the place card: fly to that story and open it.
  function openStory(story: MapStory) {
    if (!map) return
    map.once('moveend', () => setSelectedId(story.id))
    map.flyTo([story.latitude, story.longitude], 13, { duration: 1.2 })
  }

  return (
    <div>
      {/* No instructions: only a note when there's nothing to show yet. */}
      <PageHeader
        title="Map"
        hideTitle
        subtitle={stories?.length === 0 ? 'No published stories are connected to a place yet.' : undefined}
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
      <CategoryTabs shown={shownCategory} onShow={setShownCategory} />
      {/* Tall enough to explore on a phone while leaving room for the heading and the tab bar.
          Keyed on the focus so switching between an area and all stories re-frames the map. With no
          area chosen it opens on START_VIEW straight away; the dots appear as the stories load. */}
      <div className="relative">
      <BaseMap
        key={focus ? `${focus.center.lat},${focus.center.lng},${focus.radiusKm}` : 'all'}
        {...(backView ??
          (focus ? { center: focus.center, zoom: zoomForRadius(focus.radiusKm) } : START_VIEW))}
        // The rest of the screen below the header and the filter: on phones down to the bottom edge,
        // under the floating tab bar; on wider screens to just above the bottom of the window.
        className="sp-map-tab h-[calc(100dvh-8.5rem)] min-h-80 md:h-[calc(100dvh-10rem)]"
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
        {/* A tap on the map closes the story's card first, then the place's. */}
        <CloseOnMapTap onTap={() => (selectedId ? close() : closePlace())} />
        {place && (
          // Under the story dots (overlay pane), so it never hides them.
          <CircleMarker
            center={[place.lat, place.lng]}
            radius={12}
            pathOptions={{ color: '#1c1917', weight: 2, opacity: 0.75, fill: false }}
            interactive={false}
          />
        )}
        {visible?.flatMap((story) =>
          worldCopies({ lat: story.latitude, lng: story.longitude }).map((center) => (
            <StoryPin
              key={`${story.id}:${center.lng}`}
              center={center}
              color={dotColor(story.category)}
              title={story.title}
              large={story.id === selectedId}
              onSelect={() => setSelectedId(story.id)}
            />
          )),
        )}
      </BaseMap>
      {selected && <StorySheet key={selected.id} story={selected} map={map} onClose={close} />}
      {place && !selected && (
        <PlaceSheet place={place} inView={inView} all={visible} onOpenStory={openStory} onClose={closePlace} />
      )}
      {/* Place search and Locate Me as one row along the top of the map. */}
      <div className="absolute inset-x-2 top-2 z-[1000] flex items-center gap-2 md:inset-x-3 md:top-3">
        <MapSearch
          map={map}
          onPlace={(chosen) => {
            setSelectedId(null)
            setPlace(chosen)
          }}
        />
        <MapLocate map={map} />
      </div>
      </div>
    </div>
  )
}

// Text tabs above the map: All, or one story type at a time (True, Legends, Wonder), with an underline
// under the one shown. Short names so all four fit one row on a phone.
const TAB_NAMES: Record<MapCategory, string> = { 'true-tale': 'True', legend: 'Legends', 'wonder-tale': 'Wonder' }

function CategoryTabs({ shown, onShow }: { shown: MapCategory | 'all'; onShow: (category: MapCategory | 'all') => void }) {
  const tabs: { id: MapCategory | 'all'; label: string; full: string }[] = [
    { id: 'all', label: 'All', full: 'All stories' },
    ...MAP_CATEGORIES.map(({ id, label }) => ({ id, label: TAB_NAMES[id], full: label })),
  ]
  return (
    <div role="tablist" aria-label="Story types" className="scrollbar-none mb-2 flex gap-5 overflow-x-auto border-b border-stone-200 px-0.5">
      {tabs.map(({ id, label, full }) => {
        const active = shown === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={full}
            onClick={() => onShow(id)}
            className={`-mb-px shrink-0 border-b-2 pb-2 pt-1 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
              active ? 'border-stone-900 font-semibold text-stone-900' : 'border-transparent font-medium text-stone-500 hover:text-stone-900'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// The map's visible area, updated when it stops moving.
function useMapBounds(map: LeafletMap | null) {
  const [bounds, setBounds] = useState<LatLngBounds | null>(null)
  useEffect(() => {
    if (!map) return
    const update = () => setBounds(map.getBounds())
    update()
    map.on('moveend', update)
    return () => {
      map.off('moveend', update)
    }
  }, [map])
  return bounds
}

// From a story page's place line: /map?story=SP-…&part=<i> shows part i of the story's place (0: the
// story's own spot, with its card open; then its town, region, country, as PlaceTrail does on the map).
// Once per visit; not when coming back to the map, which reopens where it was left.
function useOpenLinkedStory({
  map,
  stories,
  skip,
  onSelect,
}: {
  map: LeafletMap | null
  stories: MapStory[] | undefined
  skip: boolean
  onSelect: (id: string) => void
}) {
  const [params] = useSearchParams()
  const key = params.get('story')
  const part = Math.max(0, Math.floor(Number(params.get('part')) || 0))
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (skip || !key || !map || !stories || done.current === `${key}:${part}`) return
    done.current = `${key}:${part}`
    const story = stories.find((s) => s.code === key.toUpperCase() || s.id === key)
    if (!story) return
    const at = { lat: story.latitude, lng: story.longitude }
    if (part === 0) {
      map.setView([at.lat, at.lng], storyZoom(story.locationType), { animate: false })
      onSelect(story.id)
      return
    }
    // Start from the story's spot, then frame the wider place around it.
    map.setView([at.lat, at.lng], 10, { animate: false })
    const parts = placeParts(story.place ?? '')
    if (parts[part]) void zoomToPart(map, parts, part, at, story.locationType)
  }, [skip, key, part, map, stories, onSelect])
}

// Keeps the map's view in this page's history entry (as router state), so coming back to it (the browser's
// Back, or the story form's back arrow) reopens the map where it was left.
function useRememberView(map: LeafletMap | null) {
  useEffect(() => {
    if (!map) return
    const save = () => {
      const c = map.getCenter()
      const mapView: MapView = { center: [c.lat, c.lng], zoom: map.getZoom() }
      const state = window.history.state as { usr?: object } | null
      window.history.replaceState({ ...state, usr: { ...state?.usr, mapView } }, '')
    }
    map.on('moveend', save)
    return () => {
      map.off('moveend', save)
    }
  }, [map])
}

// Tapping the map itself (not a dot) closes the story's sheet.
function CloseOnMapTap({ onTap }: { onTap: () => void }) {
  useMapEvents({ click: onTap })
  return null
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

type MapView = { center: [number, number]; zoom: number }

function mapViewOf(state: unknown): MapView | null {
  const view = (state as { mapView?: MapView } | null)?.mapView
  return view && Array.isArray(view.center) && Number.isFinite(view.zoom) ? view : null
}
