import { useConvex, useQuery } from 'convex/react'
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { api } from '../../convex/_generated/api'
import { distanceKm, NEARBY_KM, type LatLng } from '../../convex/geo'
import { geocodingEnabled, searchPlaces, type PlaceResult } from '../geocoding'
import { ArrowRightIcon, PinIcon, SearchIcon } from './Icons'

const MIN_CHARS = 2
const DEBOUNCE_MS = 250
const MAX_PLACE_RESULTS = 5

// What the reader asked to find stories around: a place they chose, or their own location.
export type FindTarget = { label: string; center: LatLng; radiusKm: number }

type Suggestion = {
  key: string
  name: string
  context: string
  group: 'storyplace' | 'places'
  target: FindTarget
}


// A village gets the default radius; a region or country covers its own extent.
function radiusFor(place: PlaceResult) {
  if (place.bbox) {
    const [w, s, e, n] = place.bbox
    const halfDiagonal = distanceKm({ lat: s, lng: w }, { lat: n, lng: e }) / 2
    return Math.round(Math.min(300, Math.max(15, halfDiagonal + 10)))
  }
  return place.pointLike ? 15 : NEARBY_KM
}

function fromStoryPlace(p: { place: string; lat: number; lng: number; storyCount: number }): Suggestion {
  return {
    key: `storyplace:${p.place}`,
    name: p.place,
    context: `${p.storyCount} ${p.storyCount === 1 ? 'story' : 'stories'} on StoryPlace`,
    group: 'storyplace',
    target: { label: p.place, center: { lat: p.lat, lng: p.lng }, radiusKm: 15 },
  }
}

function fromPlace(p: PlaceResult): Suggestion {
  return {
    key: `place:${p.id}`,
    name: p.name,
    context: [p.kind, p.context].filter(Boolean).join(' · '),
    group: 'places',
    target: { label: p.name, center: { lat: p.lat, lng: p.lng }, radiusKm: radiusFor(p) },
  }
}

// The place search on Home: a real text field with suggestions from StoryPlace's own saved place
// names and from MapTiler. Choosing a suggestion, pressing Enter, or the arrow button finds the place.
export function PlaceFinder({
  onFind,
  onNoPlace,
  describedBy,
  autoFocus = false,
}: {
  onFind: (target: FindTarget) => void
  // Nothing matched as a place.
  onNoPlace: (text: string) => void
  // The id of the page's status message, read out with the field.
  describedBy?: string
  autoFocus?: boolean
}) {
  const convex = useConvex()
  const inputId = useId()
  const listId = useId()
  const errorId = useId()
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<{ query: string; results: PlaceResult[] } | null>(null)

  const trimmed = text.trim()
  const searchable = debounced.length >= MIN_CHARS

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed])

  const storyPlaces = useQuery(api.discover.placeSuggestions, searchable ? { text: debounced } : 'skip')

  useEffect(() => {
    if (!searchable || !geocodingEnabled) return
    const controller = new AbortController()
    searchPlaces(debounced, controller.signal)
      .then((results) => setPlaces({ query: debounced, results }))
      // Suggestions are a convenience; Find stories reports errors when it matters.
      .catch(() => !controller.signal.aborted && setPlaces({ query: debounced, results: [] }))
    return () => controller.abort()
  }, [debounced, searchable])

  const suggestions: Suggestion[] = searchable
    ? [
        ...(storyPlaces ?? []).map(fromStoryPlace),
        ...(places?.query === debounced ? places.results : []).slice(0, MAX_PLACE_RESULTS).map(fromPlace),
      ]
    : []
  const loadingSuggestions = searchable && (storyPlaces === undefined || (geocodingEnabled && places?.query !== debounced))
  const showList = open && trimmed.length >= MIN_CHARS && (suggestions.length > 0 || loadingSuggestions)

  function choose(s: Suggestion) {
    setText(s.name)
    setOpen(false)
    setActive(-1)
    setError(null)
    onFind(s.target)
  }

  // Find stories for exactly what's typed: the highlighted suggestion, else the best match, looked up
  // fresh if the suggestions for this text haven't arrived yet.
  async function find() {
    setError(null)
    if (!trimmed) {
      setError('Type a place first, or use your location.')
      return
    }
    if (open && suggestions[active]) return choose(suggestions[active])
    if (debounced === trimmed && suggestions.length > 0) return choose(suggestions[0])

    setFinding(true)
    setOpen(false)
    try {
      const saved = await convex.query(api.discover.placeSuggestions, { text: trimmed })
      if (saved.length > 0) return choose(fromStoryPlace(saved[0]))
      if (geocodingEnabled) {
        const found = await searchPlaces(trimmed, new AbortController().signal)
        if (found.length > 0) return choose(fromPlace(found[0]))
      }
      onNoPlace(trimmed)
    } catch (err) {
      console.error(err)
      setError("Place search isn't responding right now. Check your connection and try again.")
    } finally {
      setFinding(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void find()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
    // Enter submits the form, which uses the highlighted suggestion if there is one.
  }

  let lastGroup: Suggestion['group'] | null = null

  return (
    <div>
      <form role="search" onSubmit={onSubmit} className="relative w-full">
        <label htmlFor={inputId} className="sr-only">
          Place to find stories near
        </label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
            setError(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Search a city, landmark, or place"
          // Room on the right only once the arrow button shows; the hint ends in "…" if it doesn't fit.
          className={`h-14 w-full text-ellipsis rounded-full border-0 bg-white pl-12 text-base text-stone-900 shadow-sm ring-1 ring-stone-300 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-900 sm:text-lg ${
            trimmed || finding ? 'pr-12' : 'pr-4'
          }`}
        />
        {/* Same as pressing Enter. Shown once there's something to search for. */}
        <button
          type="submit"
          disabled={finding}
          aria-label={finding ? 'Finding stories…' : 'Find stories'}
          title="Find stories"
          className={`absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-orange-600 text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
            trimmed || finding ? '' : 'invisible'
          }`}
        >
          {finding ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
          ) : (
            <ArrowRightIcon className="h-5 w-5" />
          )}
        </button>

        {showList && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200">
            <ul id={listId} role="listbox" aria-label="Places" className="max-h-80 overflow-y-auto py-1">
              {suggestions.map((s, i) => {
                const header = s.group !== lastGroup ? s.group : null
                lastGroup = s.group
                return (
                  <li key={s.key} role="presentation">
                    {header && (
                      <p role="presentation" className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {header === 'storyplace' ? 'On StoryPlace' : 'Places'}
                      </p>
                    )}
                    <div
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(s)}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${i === active ? 'bg-orange-50' : ''}`}
                    >
                      <PinIcon
                        className={`mt-1 h-4 w-4 shrink-0 ${s.group === 'storyplace' ? 'text-orange-600' : 'text-stone-400'}`}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-stone-900">{s.name}</span>
                        <span className="block truncate text-sm text-stone-500">{s.context}</span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
            {loadingSuggestions && <p className="px-4 py-2.5 text-sm text-stone-500">Looking for places…</p>}
          </div>
        )}
      </form>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
