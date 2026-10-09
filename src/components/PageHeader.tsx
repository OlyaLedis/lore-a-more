import type { ReactNode } from 'react'

// The heading at the top of each main page. With `hideTitle` the heading is kept for screen readers
// only, and just the subtitle (if any) shows.
export function PageHeader({
  title,
  subtitle,
  action,
  hideTitle = false,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  hideTitle?: boolean
}) {
  if (hideTitle) {
    return (
      <header className={subtitle ? 'mb-4' : undefined}>
        <h1 className="sr-only">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      </header>
    )
  }
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
