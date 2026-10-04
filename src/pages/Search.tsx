import { useQuery } from 'convex/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import {
  AGE_RANGES,
  CATEGORIES,
  THEMES,
  type AgeRange,
  type StoryCategory,
  type StoryTheme,
} from '../../convex/taxonomy'
import { SearchIcon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { StoryCard } from '../components/StoryCard'

const DEBOUNCE_MS = 250

function oneOf<T extends string>(value: string | null, allowed: readonly T[]) {
  return allowed.includes(value as T) ? (value as T) : undefined
}

// Explore all stories: search by title, place, category, theme, or pen name, and filter. Filters live
// in the URL, so tags on story pages can link straight to a filtered search.
export default function Search() {
  const [params, setParams] = useSearchParams()
  const category = oneOf<StoryCategory>(params.get('category'), CATEGORIES.map((c) => c.value))
  const age = oneOf<AgeRange>(params.get('age'), AGE_RANGES)
  const theme = oneOf<StoryTheme>(params.get('theme'), THEMES.map((t) => t.value))
  const [text, setText] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(text)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const results = useQuery(api.discover.search, {
    text: debounced.trim() || undefined,
    category,
    ageRange: age,
    theme,
  })

  function setFilter(key: 'category' | 'age' | 'theme', value: string | undefined) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  const filtered = Boolean(debounced.trim() || category || age || theme)

  return (
    <div>
      <PageHeader title="Search" subtitle="Explore every published story." />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <label htmlFor="story-search" className="sr-only">
          Search stories
        </label>
        <input
          id="story-search"
          type="search"
          enterKeyHint="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Titles, places, themes…"
          className="w-full rounded-2xl border border-stone-300 bg-white py-3 pl-12 pr-4 text-lg focus:border-stone-900 focus:outline-none"
        />
      </form>

      <div className="mt-5 space-y-3">
        <FilterRow label="Category">
          <Chip active={!category} onClick={() => setFilter('category', undefined)}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} active={category === c.value} onClick={() => setFilter('category', c.value)}>
              {c.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Suitable for">
          <Chip active={!age} onClick={() => setFilter('age', undefined)}>
            Any age
          </Chip>
          {AGE_RANGES.map((a) => (
            <Chip key={a} active={age === a} onClick={() => setFilter('age', a)}>
              Ages {a}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Theme">
          {THEMES.map((t) => (
            <Chip
              key={t.value}
              active={theme === t.value}
              onClick={() => setFilter('theme', theme === t.value ? undefined : t.value)}
            >
              {t.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <section aria-live="polite" className="mt-8">
        {results === undefined ? (
          <p className="text-stone-500">Searching…</p>
        ) : results.length === 0 ? (
          <div className="rounded-2xl bg-stone-100 px-5 py-6 text-center text-stone-600">
            {filtered ? 'No stories match. Try different words or fewer filters.' : 'No stories have been published yet.'}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-stone-500">
              {filtered ? `${results.length} ${results.length === 1 ? 'story' : 'stories'}` : 'Newest first'}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
              {results.map((story) => (
                <StoryCard key={story._id} story={story} wide />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      <div className="scrollbar-none -mr-4 flex gap-2 overflow-x-auto pr-4">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
      }`}
    >
      {children}
    </button>
  )
}
