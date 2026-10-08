import type { Map as LeafletMap, Marker } from 'leaflet'
import { Marker as LeafletMarker, popup } from 'leaflet'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { geocodingEnabled, placeCentre, searchPlaces, type PlaceResult } from '../geocoding'
import { dotColor, type MapStory } from '../mapStories'
import { flyToView, placeView, storyZoom } from '../placeZoom'
import { CloseIcon, GlobeIcon, SearchIcon } from './Icons'

const DEBOUNCE_MS = 250
const MIN_CHARS = 2
const MAX_PLACES = 6
const MAX_STORIES = 6
// How much of a description to show around the matched words.
const SNIPPET = 28

// Map search, like Felt's: a button on the map opens a panel that finds places (MapTiler: towns,
// castles, mountains…) and StoryPlace stories (title, place, or description) as you type. Choosing a
// place zooms to it by its kind (see placeZoom.ts) with a small name card and an "Add a story" button; choosing a story moves to its dot and opens its
// popup. Arrow keys move through the results, Enter chooses, Escape closes.
export function MapSearch({
  map,
  stories,
  onAddStory,
}: {
  map: LeafletMap | null
  stories: MapStory[]
  // "Add a story" on a chosen place's card. The page opens the story form there (or Sign In first).
  onAddStory?: (place: { label: string; lat: number; lng: number; pointLike: boolean }) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [places, setPlaces] = useState<{ query: string; results: PlaceResult[] } | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId = useId()

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

  // Close when clicking anywhere outside the panel.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const placeResults = searchable && places?.query === debounced ? places.results.slice(0, MAX_PLACES) : []
  const storyResults = query.length >= MIN_CHARS ? matchStories(stories, query).slice(0, MAX_STORIES) : []
  const results = [
    ...placeResults.map((place) => ({ kind: 'place' as const, place })),
    ...storyResults.map((match) => ({ kind: 'story' as const, match })),
  ]
  const placesLoading = searchable && geocodingEnabled && places?.query !== debounced

  function close() {
    setOpen(false)
  }

  function choose(index: number) {
    const result = results[index]
    if (!result || !map) return
    if (result.kind === 'place') void goToPlace(map, result.place, onAddStory)
    else goToStory(map, result.match.story)
    close()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setActive(0)
          // After the panel renders.
          setTimeout(() => inputRef.current?.select(), 0)
        }}
        aria-label="Search places and stories"
        title="Search places and stories"
        className="absolute right-3 top-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-900 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        <SearchIcon className="h-5 w-5" />
      </button>
    )
  }

  const optionId = (i: number) => `${listId}-${i}`
  let index = -1
  return (
    <div
      ref={panelRef}
      className="absolute inset-x-3 top-3 z-[1000] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white/95 backdrop-blur sm:left-auto sm:w-96"
    >
      <div className="sticky top-0 bg-white/95 p-3 backdrop-blur">
        <div className="flex items-center gap-2 rounded-xl border-2 border-orange-200 bg-white px-3 focus-within:border-orange-400">
          <SearchIcon className="h-5 w-5 shrink-0 text-stone-700" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search places and stories"
            aria-label="Search places and stories"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? optionId(active) : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-stone-400"
          />
          <button
            type="button"
            onClick={() => (text ? (setText(''), inputRef.current?.focus()) : close())}
            aria-label={text ? 'Clear search' : 'Close search'}
            className="rounded-full p-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div id={listId} role="listbox" aria-label="Search results" className="pb-2">
        {query.length >= MIN_CHARS && (
          <>
            {geocodingEnabled && (
              <Group title="Locations">
                {placeResults.map((place) => {
                  const i = ++index
                  return (
                    <Option key={place.id} id={optionId(i)} active={active === i} onHover={() => setActive(i)} onChoose={() => choose(i)}>
                      <GlobeIcon className="mt-0.5 h-5 w-5 shrink-0 text-stone-800" />
                      <span className="min-w-0">
                        <span className="block truncate text-stone-800">
                          <Highlight text={place.name} query={query} />
                        </span>
                        {place.context && <span className="block truncate text-sm text-stone-500">{place.context}</span>}
                      </span>
                    </Option>
                  )
                })}
                {placesLoading && placeResults.length === 0 && <Note>Searching places…</Note>}
                {!placesLoading && placeResults.length === 0 && <Note>No places found.</Note>}
              </Group>
            )}
            <Group title="StoryPlace Stories">
              {storyResults.map(({ story, field, value }) => {
                const i = ++index
                return (
                  <Option key={story.id} id={optionId(i)} active={active === i} onHover={() => setActive(i)} onChoose={() => choose(i)}>
                    <span
                      aria-hidden
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: dotColor(story.category) }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-stone-800">
                        <Highlight text={story.title} query={field === 'title' ? query : ''} />
                      </span>
                      {field !== 'title' && (
                        <span className="block truncate text-sm text-stone-500">
                          {field}: <Highlight text={value} query={query} />
                        </span>
                      )}
                    </span>
                  </Option>
                )
              })}
              {storyResults.length === 0 && <Note>No stories match.</Note>}
            </Group>
          </>
        )}
        {query.length < MIN_CHARS && <Note>Type a town, landmark, or story.</Note>}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="mt-1">
      <p className="px-4 pb-1 pt-2 text-sm text-stone-500">{title}</p>
      {children}
    </div>
  )
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

type StoryMatch = { story: MapStory; field: 'title' | 'place' | 'description'; value: string }

// Stories whose title, place, or description contains the text; title matches first.
function matchStories(stories: MapStory[], query: string): StoryMatch[] {
  const byField: Record<StoryMatch['field'], StoryMatch[]> = { title: [], place: [], description: [] }
  for (const story of stories) {
    if (findIn(story.title, query)) {
      byField.title.push({ story, field: 'title', value: story.title })
    } else if (story.place && findIn(story.place, query)) {
      byField.place.push({ story, field: 'place', value: story.place })
    } else {
      const range = findIn(story.shortDescription, query)
      if (range) byField.description.push({ story, field: 'description', value: snippet(story.shortDescription, range) })
    }
  }
  return [...byField.title, ...byField.place, ...byField.description]
}

// A short piece of the description around the match, e.g. "… near Eppstein. Knight Eppo set…".
function snippet(text: string, [start, end]: [number, number]) {
  const from = Math.max(0, start - SNIPPET)
  const to = Math.min(text.length, end + SNIPPET)
  return `${from > 0 ? '… ' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`
}

// Zooms to the place by what kind it is (placeView: a country framed whole, a town centred at zoom 14
// as on Felt, a castle close in) and points a small card at it with its name and where it is, e.g.
// "Eppstein / Hesse, Germany".
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

// Moves to the story's dot (the copy in the main world) and opens its popup.
function goToStory(map: LeafletMap, story: MapStory) {
  map.flyTo([story.latitude, story.longitude], storyZoom(story.locationType), { duration: 0.8 })
  map.once('moveend', () => {
    let marker: Marker | null = null
    map.eachLayer((layer) => {
      if (marker || !(layer instanceof LeafletMarker)) return
      const at = layer.getLatLng()
      if (layer.options.title === story.title && at.lat === story.latitude && at.lng === story.longitude) marker = layer
    })
    ;(marker as Marker | null)?.openPopup()
  })
}
