import type { ReactNode } from 'react'

// The large heading at the top of each main page.
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
