import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { geocodingEnabled, searchPlaces, type PlaceResult } from '../geocoding'

const MIN_CHARS = 2
const DEBOUNCE_MS = 250

// The last finished search. Loading and idle are derived from it during render.
type Settled = { query: string } & ({ kind: 'done'; results: PlaceResult[] } | { kind: 'error' })

export function PlaceSearch({
  inputId,
  onSelect,
  onManual,
  placeholder = 'Search for a town, landmark, mountain, or region',
}: {
  inputId: string
  onSelect: (place: PlaceResult) => void
  // Fallback when search can't find the place or isn't available: choose it on a map instead.
  onManual?: (typed: string) => void
  placeholder?: string
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [settled, setSettled] = useState<Settled | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const trimmed = query.trim()
  const searchable = geocodingEnabled && trimmed.length >= MIN_CHARS
  const state = !searchable
    ? ({ kind: 'idle' } as const)
    : settled?.query === trimmed
      ? settled
      : ({ kind: 'loading' } as const)

  useEffect(() => {
    if (!searchable) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(trimmed, controller.signal)
        .then((results) => {
          setSettled({ query: trimmed, kind: 'done', results })
          setActive(results.length ? 0 : -1)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            console.error(err)
            setSettled({ query: trimmed, kind: 'error' })
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, searchable])

  const results = state.kind === 'done' ? state.results : []
  const showPanel = open && searchable

  function choose(place: PlaceResult) {
    onSelect(place)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      if (results.length) setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (results.length) setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      // Never submit the whole story form from the search box.
      e.preventDefault()
      if (showPanel && results[active]) choose(results[active])
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  const manualButton = (text: string) =>
    onManual && (
      <>
        {' '}
        or{' '}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onManual(trimmed)}
          className="font-medium text-stone-900 underline"
        >
          {text}
        </button>
      </>
    )

  return (
    <>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={showPanel && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          disabled={!geocodingEnabled}
        />

        {showPanel && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            <ul id={listId} role="listbox" aria-label="Matching places" className="max-h-72 overflow-y-auto">
              {results.map((place, i) => (
                <li
                  key={place.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(place)}
                  className={`cursor-pointer px-3 py-2.5 ${i === active ? 'bg-stone-100' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{place.name}</span>
                    {place.kind && <span className="shrink-0 text-xs text-stone-500">{place.kind}</span>}
                  </div>
                  {place.context && <div className="text-sm text-stone-500">{place.context}</div>}
                </li>
              ))}
            </ul>
            <div role="status" aria-live="polite" className="text-sm text-stone-500 empty:hidden">
              {state.kind === 'loading' && results.length === 0 && <p className="px-3 py-2.5">Searching…</p>}
              {state.kind === 'done' && results.length === 0 && (
                <p className="px-3 py-2.5">
                  No places match “{trimmed}”. Try a nearby town or a different spelling
                  {manualButton('choose it on the map')}.
                </p>
              )}
              {state.kind === 'error' && (
                <p className="px-3 py-2.5 text-red-600">
                  Place search isn't working right now. Try again
                  {manualButton('choose it on the map')}.
                </p>
              )}
            </div>
            <p className="border-t border-stone-100 px-3 py-1.5 text-right text-xs text-stone-400">
              Search by MapTiler
            </p>
          </div>
        )}
      </div>
      {geocodingEnabled && onManual && (
        <button
          type="button"
          onClick={() => onManual(trimmed)}
          className="mt-2 text-sm font-medium text-stone-700 underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
        >
          Can’t find the place? Choose it on the map.
        </button>
      )}

      {!geocodingEnabled && (
        <p className="mt-2 text-sm text-stone-500">
          Place search isn't set up on this site yet{manualButton('choose the place on the map')}.
        </p>
      )}
    </>
  )
}
