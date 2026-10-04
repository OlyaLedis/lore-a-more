// Simple line icons (24×24, currentColor), drawn for StoryPlace.
type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HomeIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function NewIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function LibraryIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4v16M9.5 4v16M14 5.2l4.6 14.4" />
    </svg>
  )
}

export function SearchIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

export function PlusIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function PinIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}

export function BookmarkIcon({ className = 'h-5 w-5', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} className={className}>
      <path d="M6.5 4h11a1 1 0 0 1 1 1v15.5L12 16.5l-6.5 4V5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

export function CheckIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
