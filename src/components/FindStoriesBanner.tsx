import { useConvex, useQuery } from 'convex/react'
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { api } from '../../convex/_generated/api'
import { distanceKm, NEARBY_KM, type LatLng } from '../../convex/geo'
import { geocodingEnabled, searchPlaces, type PlaceResult } from '../geocoding'
import { LocateIcon, PinIcon, SearchIcon } from './Icons'

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

export type BannerStatus = { tone: 'info' | 'error'; text: string } | null

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

// The first thing on Home: find stories around a place the reader types, or around them.
export function FindStoriesBanner({
  onFind,
  onNoPlace,
  onUseLocation,
  locating,
  status,
}: {
  onFind: (target: FindTarget) => void
  // Nothing matched as a place; Home falls back to searching story text.
  onNoPlace: (text: string) => void
  onUseLocation: () => void
  locating: boolean
  status: BannerStatus
}) {
  const convex = useConvex()
  const inputId = useId()
  const listId = useId()
  const statusId = useId()
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

  const message = error ? { tone: 'error' as const, text: error } : status
  let lastGroup: Suggestion['group'] | null = null

  return (
    <section aria-labelledby={`${inputId}-heading`} className="relative rounded-3xl ring-1 ring-orange-200/70">
      <BannerBackdrop />
      <div className="relative p-4 sm:p-6">
        {/* The field and buttons explain themselves; the heading is for screen readers. */}
        <h2 id={`${inputId}-heading`} className="sr-only">
          Find stories near a place
        </h2>

        <form role="search" onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
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
              aria-describedby={statusId}
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
              placeholder="Search a city, landmark, or place…"
              className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-stone-900 sm:text-lg shadow-sm ring-1 ring-stone-300 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />

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
          </div>
          <button
            type="submit"
            disabled={finding}
            className="h-14 shrink-0 rounded-2xl bg-orange-600 px-7 text-lg font-semibold text-white shadow-sm hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-70"
          >
            {finding ? 'Finding…' : 'Find stories'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-stone-600">or</span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              onUseLocation()
            }}
            disabled={locating}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-900/20 bg-white/70 px-5 font-semibold text-stone-900 hover:border-stone-900/40 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-70"
          >
            <LocateIcon className="h-5 w-5 text-orange-700" />
            {locating ? 'Finding your location…' : 'Use my location'}
          </button>
        </div>

        <p
          id={statusId}
          role={message?.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 max-w-2xl text-sm empty:hidden ${message?.tone === 'error' ? 'font-medium text-red-700' : 'text-stone-700'}`}
        >
          {message?.text}
        </p>
      </div>
    </section>
  )
}

// Warm paper with faint contour lines and a dotted trail to a pin: a map, drawn for StoryPlace.
function BannerBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-linear-to-br from-orange-50 via-amber-50 to-rose-50">
      <svg className="absolute -right-24 -top-16 h-[34rem] w-[34rem] text-orange-200 opacity-50 sm:-right-10 sm:opacity-70" viewBox="0 0 400 400" fill="none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M ${200 - 40 - i * 26} 200 C ${200 - 40 - i * 26} ${130 - i * 22}, ${250 + i * 18} ${120 - i * 24}, ${262 + i * 24} 190 S ${190 + i * 6} ${300 + i * 22}, ${200 - 40 - i * 26} 200 Z`}
            stroke="currentColor"
            strokeWidth="1.6"
          />
        ))}
      </svg>
    </div>
  )
}
