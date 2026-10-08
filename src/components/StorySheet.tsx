import type { Map as LeafletMap } from 'leaflet'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { themeLabel } from '../../convex/taxonomy'
import { googleMapsUrl, precisionNote } from '../location'
import { MAP_CATEGORIES, type MapStory } from '../mapStories'
import { CloseIcon } from './Icons'
import { PlaceTrail } from './PlaceTrail'

// The Map tab's story preview: a compact card layered over the bottom of the map (above the phone's
// tab bar; bottom left on wider screens), instead of a popup over the story's place. When it opens,
// the map moves so the story's dot sits in the open area above the card, never under it.
export function StorySheet({
  story,
  map,
  onClose,
}: {
  story: MapStory
  map: LeafletMap | null
  onClose: () => void
}) {
  const sheet = useRef<HTMLDivElement>(null)

  // Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep the dot in view: centred in the part of the map not covered by the card.
  useEffect(() => {
    if (!map) return
    const frame = requestAnimationFrame(() => {
      const card = sheet.current?.getBoundingClientRect()
      const box = map.getContainer().getBoundingClientRect()
      if (!card) return
      const dot = map.latLngToContainerPoint([story.latitude, story.longitude])
      // On a phone the card spans the width, so the free area is above it; on wider screens it sits
      // at the bottom left, so the free area is the rest of the map to its right.
      const wide = card.width < box.width * 0.6
      const freeTop = 0
      const freeBottom = wide ? box.height : card.top - box.top
      const freeLeft = wide ? card.right - box.left : 0
      const target = { x: (freeLeft + box.width) / 2, y: (freeTop + freeBottom) / 2 }
      map.panBy([dot.x - target.x, dot.y - target.y], { duration: 0.4 })
    })
    return () => cancelAnimationFrame(frame)
  }, [map, story])

  const category = MAP_CATEGORIES.find((c) => c.id === story.category)
  const note = precisionNote(story.locationType)
  return (
    <div
      ref={sheet}
      role="dialog"
      aria-label={story.title}
      className="absolute inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[1000] rounded-2xl border border-stone-200/80 bg-white/95 px-4 pb-4 pt-3 shadow-lg shadow-stone-900/10 backdrop-blur md:inset-x-auto md:bottom-4 md:left-4 md:w-[22rem]"
    >
      <div className="flex items-start justify-between gap-3">
        {category ? (
          <p className="font-serif text-sm italic" style={{ color: category.ink }}>
            {category.phrase}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 -mt-1 rounded-full p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <h2 className="mt-0.5 font-serif text-xl font-semibold leading-snug tracking-tight text-stone-900">{story.title}</h2>

      {story.place && (
        <p className="mt-1 text-[13px] leading-snug text-stone-600">
          <PlaceTrail
            place={story.place}
            at={{ lat: story.latitude, lng: story.longitude }}
            precision={story.locationType}
            map={map}
            onZoom={onClose}
          />
          {note && story.locationType !== 'exact' && <span className="text-stone-400"> · {note}</span>}
        </p>
      )}

      {story.shortDescription && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-700">{story.shortDescription}</p>
      )}

      {story.themes && story.themes.length > 0 && (
        <p className="mt-2 truncate text-xs text-stone-500">{story.themes.map(themeLabel).join(' · ')}</p>
      )}

      <div className="mt-3 flex items-center gap-4">
        {story.href ? (
          <Link
            to={story.href}
            className="rounded-full bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            Open story
          </Link>
        ) : (
          story.source && (
            <a
              href={story.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-semibold text-orange-700 hover:underline"
            >
              Source ↗
            </a>
          )
        )}
        <a
          href={googleMapsUrl({ lat: story.latitude, lng: story.longitude })}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
        >
          Google Maps ↗
        </a>
      </div>
    </div>
  )
}
