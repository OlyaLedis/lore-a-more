import { PIN_COLORS } from '../mapStyle'
import { TYPE_SYMBOLS, type StoryType } from '../storyTypes'

// A story type's symbol on a round disc of its colour, as on the map pins. `muted` greys it out
// (a hidden type in the legend).
export function StoryTypeIcon({ type, size = 24, muted = false }: { type: StoryType; size?: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: muted ? '#d6d3d1' : PIN_COLORS[type] }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        fill="none"
        stroke="#fff"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TYPE_SYMBOLS[type].paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  )
}
