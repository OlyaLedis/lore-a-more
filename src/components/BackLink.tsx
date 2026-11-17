import type { BackLink as Back } from '../backLink'
import { ArrowLeftIcon } from './Icons'

// The quiet "← Map" at the top of every page that isn't a tab (see src/backLink.ts). Renders nothing
// when there's nowhere to go.
export function BackLink({ back, className = '' }: { back: Back | null; className?: string }) {
  if (!back) return null
  return (
    <button
      type="button"
      onClick={back.go}
      className={`-ml-1 inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${className}`}
    >
      <ArrowLeftIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{back.label}</span>
    </button>
  )
}
