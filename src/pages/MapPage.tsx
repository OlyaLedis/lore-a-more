import { useQuery } from 'convex/react'
import type { LatLngBounds } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Circle, Popup, useMap, useMapEvents } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { MapLegend } from '../components/MapLegend'
import { PageHeader } from '../components/PageHeader'
import { StoryCover } from '../components/StoryCard'
import { BaseMap, StoryPin, type LatLng } from '../components/StoryMap'
import { byline } from '../format'
import { precisionNote } from '../location'
import type { StoryType } from '../storyTypes'

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

// The story map: every published story that's connected to a place, as a pin.
export default function MapPage() {
  const stories = useQuery(api.stories.mapped)
  const focus = useFocusArea()
  // Story types switched off in the legend, and the part of the map on screen (for the counts).
  const [hidden, setHidden] = useState<Set<StoryType>>(new Set())
  const [bounds, setBounds] = useState<LatLngBounds | null>(null)

  const typeOf = (story: { category?: StoryType }): StoryType => story.category ?? 'none'
  const visible = stories?.filter((s) => !hidden.has(typeOf(s))) ?? []
  const counts: Record<StoryType, number> = { local_legend: 0, personal: 0, place: 0, folktale: 0, none: 0 }
  for (const s of stories ?? []) {
    if (!bounds || bounds.contains([s.location.lat, s.location.lng])) counts[typeOf(s)]++
  }
  const toggle = (type: StoryType) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })

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
              : 'Drag and zoom to explore. Tap a pin to see its story.'
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
      {/* Tall enough to explore on a phone while leaving room for the heading and the tab bar.
          Keyed on the focus so switching between an area and all stories re-frames the map. */}
      <div className="relative">
      <BaseMap
        key={focus ? `${focus.center.lat},${focus.center.lng},${focus.radiusKm}` : 'all'}
        center={focus?.center}
        zoom={focus ? zoomForRadius(focus.radiusKm) : undefined}
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
        {stories && !focus && <FitToStories points={stories.map((s) => s.location)} />}
        <TrackBounds onChange={setBounds} />
        {visible.map((story) => (
          <StoryPin key={story._id} center={story.location} precision={story.location.precision} category={story.category} title={story.title}>
            <Popup>
              <div className="mb-2 w-24">
                <StoryCover category={story.category} cover={story.cover} />
              </div>
              <p className="!m-0 font-serif text-base font-semibold leading-snug">{story.title}</p>
              <p className="!mb-0 !mt-1 text-stone-500">
                {byline(story.author)}
                {story.location.place && ` · ${story.location.place}`}
              </p>
              {precisionNote(story.location.precision) && (
                <p className="!m-0 text-xs text-stone-500">{precisionNote(story.location.precision)}</p>
              )}
              <Link
                to={`/story/${story._id}`}
                className="mt-2 inline-block rounded-full bg-orange-600 px-3.5 py-1.5 text-sm font-semibold !text-white no-underline hover:bg-orange-700"
              >
                Open story
              </Link>
            </Popup>
          </StoryPin>
        ))}
      </BaseMap>
      {stories && stories.length > 0 && (
        <MapLegend
          counts={counts}
          hidden={hidden}
          onToggle={toggle}
          onShowAll={() => setHidden(new Set())}
          showOther={stories.some((s) => !s.category)}
        />
      )}
      </div>
    </div>
  )
}

// Reports the part of the map on screen whenever it changes, for the legend's counts.
function TrackBounds({ onChange }: { onChange: (bounds: LatLngBounds) => void }) {
  const map = useMapEvents({ moveend: () => onChange(map.getBounds()) })
  useEffect(() => {
    map.whenReady(() => onChange(map.getBounds()))
  }, [map, onChange])
  return null
}

// Frames the stories once when they first load, so a few nearby stories aren't lost in a world view.
// After that the reader is in control of the map.
function FitToStories({ points }: { points: LatLng[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || points.length === 0) return
    done.current = true
    if (points.length === 1) {
      map.setView(points[0], 9)
    } else {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 9 },
      )
    }
  }, [map, points])
  return null
}
