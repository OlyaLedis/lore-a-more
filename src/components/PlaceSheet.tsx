import { useEffect } from 'react'
import { distanceKm } from '../../convex/geo'
import { dotColor, MAP_CATEGORIES, type MapCategory, type MapStory } from '../mapStories'
import { CloseIcon } from './Icons'
import type { ChosenPlace } from './MapSearch'

// A place chosen in the map search, as a card at the bottom of the map (where StorySheet opens), so
// the place itself and any story dots around it stay visible. It counts the stories in view by type,
// in their dot colours; with none in view it names the nearest story, which can be opened.
export function PlaceSheet({
  place,
  inView,
  all,
  onOpenStory,
  onClose,
}: {
  place: ChosenPlace
  // Stories of the type shown inside the map's view, and all of them; undefined while they load.
  inView: MapStory[] | undefined
  all: MapStory[] | undefined
  onOpenStory: (story: MapStory) => void
  onClose: () => void
}) {
  // Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const byType = MAP_CATEGORIES.map((c) => ({ ...c, n: inView?.filter((s) => s.category === c.id).length ?? 0 })).filter(
    (c) => c.n > 0,
  )
  // Stories with a retired type (see legacyCategory) have a neutral dot.
  const untyped = inView?.filter((s) => s.category === null).length ?? 0
  const nearest =
    inView?.length === 0 && all?.length
      ? all
          .map((story) => ({ story, km: distanceKm(place, { lat: story.latitude, lng: story.longitude }) }))
          .reduce((a, b) => (b.km < a.km ? b : a))
      : null

  return (
    <div
      role="dialog"
      aria-label={place.name}
      className="absolute inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[1000] rounded-2xl border border-stone-200/80 bg-white/95 py-3 pl-4 pr-3 shadow-lg shadow-stone-900/10 backdrop-blur md:inset-x-auto md:bottom-4 md:left-4 md:w-[22rem]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-stone-900">{place.name}</p>
          {place.context && <p className="truncate text-[13px] text-stone-500">{place.context}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      {inView && inView.length > 0 && (
        <div className="mt-2 border-t border-stone-100 pt-2 text-[13px] text-stone-600">
          <p className="font-medium text-stone-900">
            {inView.length} {inView.length === 1 ? 'story' : 'stories'} on the map here
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {byType.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.n} {typeName(c.id, c.n)}
              </span>
            ))}
            {untyped > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: dotColor(null) }} aria-hidden />
                {untyped} other
              </span>
            )}
          </p>
        </div>
      )}

      {inView?.length === 0 && (
        <div className="mt-2 border-t border-stone-100 pt-2 text-[13px] text-stone-600">
          <p className="font-medium text-stone-900">No stories here yet</p>
          {nearest && (
            <button
              type="button"
              onClick={() => onOpenStory(nearest.story)}
              className="mt-1 flex w-full min-w-0 items-center gap-1.5 text-left hover:text-stone-900"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor(nearest.story.category) }} aria-hidden />
              <span className="shrink-0">Nearest:</span>
              <span className="truncate font-serif text-sm font-semibold text-stone-900 underline-offset-2 hover:underline">
                {nearest.story.title}
              </span>
              <span className="shrink-0 text-stone-500">· {formatKm(nearest.km)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const NAMES: Record<MapCategory, [string, string]> = {
  'true-tale': ['true tale', 'true tales'],
  legend: ['legend', 'legends'],
  'wonder-tale': ['wonder tale', 'wonder tales'],
}

function typeName(id: MapCategory, n: number) {
  return NAMES[id][n === 1 ? 0 : 1]
}

function formatKm(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en')} km`
}
