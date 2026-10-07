import { useState } from 'react'
import { CATEGORIES } from '../../convex/taxonomy'
import { PIN_COLORS } from '../mapStyle'
import type { StoryType } from '../storyTypes'
import { StoryTypeIcon } from './StoryTypeIcon'

const ROWS: { type: StoryType; label: string }[] = [
  ...CATEGORIES.map(({ value, label }) => ({ type: value as StoryType, label })),
  { type: 'none', label: 'Other stories' },
]

// The map's key: each story type with its colour and symbol, how many of its stories are in view,
// and a tap to hide or show them. Below, what the two pin shapes mean. On phones it starts folded
// into a small button so it doesn't cover the map.
export function MapLegend({
  counts,
  hidden,
  onToggle,
  onShowAll,
  showOther,
}: {
  counts: Record<StoryType, number>
  hidden: Set<StoryType>
  onToggle: (type: StoryType) => void
  onShowAll: () => void
  // "Other stories" (older stories without a type) only appears when there are some.
  showOther: boolean
}) {
  const [open, setOpen] = useState(false)
  const rows = ROWS.filter((r) => r.type !== 'none' || showOther)

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-sm font-semibold text-stone-800 shadow-md ring-1 ring-stone-900/10 sm:hidden"
      >
        <span aria-hidden className="flex -space-x-1.5">
          {rows.slice(0, 4).map((r) => (
            <StoryTypeIcon key={r.type} type={r.type} size={18} />
          ))}
        </span>
        Story types
      </button>

      <section
        aria-label="Story types"
        className={`${open ? 'block' : 'hidden'} w-64 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-stone-900/10 backdrop-blur sm:block`}
      >
        <div className="mb-1 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-stone-900">Story types</h2>
          {hidden.size > 0 && (
            <button type="button" onClick={onShowAll} className="text-xs font-semibold text-orange-700 hover:underline">
              Show all
            </button>
          )}
        </div>
        <ul>
          {rows.map(({ type, label }) => {
            const shown = !hidden.has(type)
            return (
              <li key={type}>
                <button
                  type="button"
                  aria-pressed={shown}
                  onClick={() => onToggle(type)}
                  title={shown ? `Hide ${label}` : `Show ${label}`}
                  className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-stone-900"
                >
                  <StoryTypeIcon type={type} size={26} muted={!shown} />
                  <span className={`flex-1 text-sm font-medium ${shown ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
                    {label}
                  </span>
                  <span className={`text-sm tabular-nums ${shown ? 'text-stone-500' : 'text-stone-300'}`}>{counts[type]}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-1 px-1.5 text-[11px] text-stone-500">Numbers count stories in this part of the map.</p>
        {/* What the two pin shapes mean. */}
        <div className="mt-2 flex items-center gap-4 border-t border-stone-200 px-1.5 pt-2.5 text-xs text-stone-600">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: PIN_COLORS.none }} />
            Exact spot
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-5 w-5 rounded-full border-2"
              style={{ borderColor: PIN_COLORS.none, background: 'rgb(234 88 12 / 0.22)' }}
            />
            General area
          </span>
        </div>
      </section>
    </div>
  )
}
