import type { Map as LeafletMap } from 'leaflet'
import { popup } from 'leaflet'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { geocodingEnabled, placeCentre, searchPlaces, type PlaceResult } from '../geocoding'
import { flyToView, placeView } from '../placeZoom'
import { CloseIcon, GlobeIcon, PinIcon } from './Icons'

const DEBOUNCE_MS = 250
const MIN_CHARS = 2
const MAX_PLACES = 6

// Place search above the map: a field (map-pin icon, so it reads as a place search rather than a
// story search) that finds towns, addresses, castles, mountains… (MapTiler) as you type, ranked near
// the map's centre. Choosing a place zooms to it by its kind (see placeZoom.ts) with a small name card
// and an "Add a story" button. Arrow keys move through the results, Enter chooses, Escape closes.
// Stories are found on the Search tab.
export function MapSearch({
  map,
  onAddStory,
}: {
  map: LeafletMap | null
  // "Add a story" on a chosen place's card. The page opens the story form there (or Sign In first).
  onAddStory?: (place: { label: string; lat: number; lng: number; pointLike: boolean }) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [places, setPlaces] = useState<{ query: string; results: PlaceResult[] } | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  // A shorter placeholder where the full one would be cut off.
  const narrow = useNarrow()

  const query = text.trim()
  const searchable = debounced.length >= MIN_CHARS

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!searchable || !geocodingEnabled) return
    const controller = new AbortController()
    const center = map?.getCenter().wrap()
    searchPlaces(debounced, controller.signal, center ? { lat: center.lat, lng: center.lng } : undefined)
      .then((results) => setPlaces({ query: debounced, results }))
      .catch(() => !controller.signal.aborted && setPlaces({ query: debounced, results: [] }))
    return () => controller.abort()
    // The map centre is read when the text changes, not on every pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, searchable])

  // Close the results when tapping anywhere else.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const results = searchable && places?.query === debounced ? places.results.slice(0, MAX_PLACES) : []
  const loading = searchable && geocodingEnabled && places?.query !== debounced
  const showList = open && query.length >= MIN_CHARS

  function choose(index: number) {
    const place = results[index]
    if (!place || !map) return
    void goToPlace(map, place, onAddStory)
    setText(place.name)
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  const optionId = (i: number) => `${listId}-${i}`
  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-3 shadow-sm shadow-stone-900/5 backdrop-blur focus-within:border-stone-400">
        <PinIcon className="h-4 w-4 shrink-0 text-stone-500" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={narrow ? 'Search places, cities' : 'Search places, cities, landmarks'}
          aria-label="Search places"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? optionId(active) : undefined}
          disabled={!geocodingEnabled}
          // 16px on phones so the browser doesn't zoom the page when the field is tapped.
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:truncate placeholder:text-stone-400 disabled:cursor-not-allowed sm:text-sm"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="-mr-1 rounded-full p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Places"
          className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-80 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-md shadow-stone-900/5"
        >
          {results.map((place, i) => (
            <Option key={place.id} id={optionId(i)} active={active === i} onHover={() => setActive(i)} onChoose={() => choose(i)}>
              <GlobeIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-700" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-stone-800">
                  <Highlight text={place.name} query={query} />
                </span>
                {place.context && <span className="block truncate text-xs text-stone-500">{place.context}</span>}
              </span>
            </Option>
          ))}
          {loading && results.length === 0 && <Note>Searching places…</Note>}
          {!loading && results.length === 0 && <Note>No places found.</Note>}
        </div>
      )}
    </div>
  )
}

function useNarrow() {
  const query = '(max-width: 479px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

function Option({
  id,
  active,
  onHover,
  onChoose,
  children,
}: {
  id: string
  active: boolean
  onHover: () => void
  onChoose: () => void
  children: ReactNode
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onPointerEnter={onHover}
      // Before the input loses focus, so the panel doesn't close first.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onChoose}
      className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${active ? 'bg-orange-50' : ''}`}
    >
      {children}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-4 py-2 text-sm text-stone-500">{children}</p>
}

// Accents and letter case don't matter: "zurich" finds "Zürich". `map[i]` is the position in the
// original text of the i-th character of the folded text, so matches can be shown in the original.
function fold(text: string) {
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const plain = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    for (const ch of plain) {
      folded += ch
      map.push(i)
    }
  }
  return { folded, map }
}

function findIn(text: string, query: string): [number, number] | null {
  const q = fold(query).folded
  if (!q) return null
  const { folded, map } = fold(text)
  const at = folded.indexOf(q)
  if (at === -1) return null
  return [map[at], map[at + q.length - 1] + 1]
}

// The matched part in bold.
function Highlight({ text, query }: { text: string; query: string }) {
  const range = query ? findIn(text, query) : null
  if (!range) return <>{text}</>
  const [start, end] = range
  return (
    <>
      {text.slice(0, start)}
      <strong className="font-bold text-stone-950">{text.slice(start, end)}</strong>
      {text.slice(end)}
    </>
  )
}

async function goToPlace(
  map: LeafletMap,
  place: PlaceResult,
  onAddStory?: (place: { label: string; lat: number; lng: number; pointLike: boolean }) => void,
) {
  map.closePopup()
  // A town's centre rather than the middle of its whole area (see placeCentre); a moment at most.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  const { lat, lng } = await placeCentre(place, controller.signal)
  clearTimeout(timer)
  flyToView(map, placeView(place, { lat, lng }))
  map.once('moveend', () => {
    // Built with text nodes, so place names from the search service are never read as HTML.
    const card = document.createElement('div')
    const name = card.appendChild(document.createElement('p'))
    name.className = '!m-0 text-base font-semibold text-stone-900'
    name.textContent = place.name
    if (place.context) {
      const where = card.appendChild(document.createElement('p'))
      where.className = '!mb-0 !mt-1 text-sm text-stone-500'
      where.textContent = place.context
    }
    if (onAddStory) {
      // Like Felt's "Add comment": a story about this place, with the place already filled in.
      const add = card.appendChild(document.createElement('button'))
      add.type = 'button'
      add.className =
        'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-900 hover:bg-stone-50'
      add.textContent = '+ Add a story'
      add.addEventListener('click', () => onAddStory({ label: place.label, lat, lng, pointLike: place.pointLike }))
    }
    popup({ className: 'sp-place-card', offset: [0, -4], autoPan: false }).setLatLng([lat, lng]).setContent(card).openOn(map)
  })
}
