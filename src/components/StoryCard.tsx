import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Id } from '../../convex/_generated/dataModel'
import { categoryLabel, themeLabel, type AgeRange, type StoryCategory, type StoryTheme } from '../../convex/taxonomy'
import { byline } from '../format'
import { PinIcon } from './Icons'

export type CardStory = {
  _id: Id<'stories'>
  title: string
  author?: string
  category?: StoryCategory
  ageRange?: AgeRange
  themes?: StoryTheme[]
  place?: string
}

// Each category has its own cover colors. Stories from before categories get a neutral cover.
const covers: Record<StoryCategory | 'none', string> = {
  local_legend: 'from-indigo-700 via-violet-600 to-fuchsia-500',
  personal: 'from-rose-600 via-orange-500 to-amber-400',
  place: 'from-emerald-700 via-teal-600 to-cyan-500',
  folktale: 'from-amber-700 via-orange-600 to-red-500',
  none: 'from-stone-600 via-stone-500 to-stone-400',
}

export function AgeBadge({ age, onCover = false }: { age?: AgeRange; onCover?: boolean }) {
  if (!age) return null
  return (
    <span
      title={`Suitable for ages ${age}`}
      className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${
        onCover ? 'bg-white/90 text-stone-900' : 'border border-stone-300 text-stone-700'
      }`}
    >
      {age}
    </span>
  )
}

function Cover({ story, size }: { story: CardStory; size: 'card' | 'hero' }) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-linear-to-br text-white ${
        covers[story.category ?? 'none']
      } ${size === 'hero' ? 'min-h-56 rounded-3xl p-6 sm:min-h-64 sm:p-8' : 'aspect-square rounded-2xl p-3'}`}
    >
      {/* A soft circle for depth; purely decorative. */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
      <div className="relative flex items-start justify-between gap-2">
        <span className={`font-medium uppercase tracking-wide text-white/85 ${size === 'hero' ? 'text-xs' : 'text-[10px]'}`}>
          {story.category ? categoryLabel(story.category) : 'Story'}
        </span>
        <AgeBadge age={story.ageRange} onCover />
      </div>
      <p
        className={`relative font-serif font-semibold leading-tight ${
          size === 'hero' ? 'text-3xl sm:text-4xl' : 'line-clamp-4 text-lg'
        }`}
      >
        {story.title}
      </p>
    </div>
  )
}

// A story in a horizontal shelf or a grid.
export function StoryCard({ story, note, wide = false }: { story: CardStory; note?: string; wide?: boolean }) {
  return (
    <Link
      to={`/story/${story._id}`}
      className={`group block shrink-0 snap-start rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 ${
        wide ? 'w-full' : 'w-40 sm:w-48'
      }`}
    >
      <div className="transition group-hover:brightness-110">
        <Cover story={story} size="card" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium group-hover:underline">{story.title}</p>
      <p className="line-clamp-1 text-sm text-stone-500">
        {note ?? (story.place ? <PlaceText place={story.place} /> : byline(story.author))}
      </p>
    </Link>
  )
}

function PlaceText({ place }: { place: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <PinIcon className="h-3.5 w-3.5 shrink-0" />
      {place}
    </span>
  )
}

// The big first card on Home.
export function HeroStoryCard({ story, eyebrow, detail }: { story: CardStory; eyebrow: string; detail?: string }) {
  return (
    <Link
      to={`/story/${story._id}`}
      className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-700">{eyebrow}</p>
      <div className="transition group-hover:brightness-110">
        <Cover story={story} size="hero" />
      </div>
      <p className="mt-3 text-stone-600">
        {story.place && <PlaceText place={story.place} />}
        {detail && <span className="text-stone-500"> · {detail}</span>}
      </p>
    </Link>
  )
}

// A titled section of cards that scrolls sideways.
export function Shelf({
  title,
  subtitle,
  seeAll,
  children,
}: {
  title: string
  subtitle?: string
  seeAll?: string
  children: ReactNode
}) {
  return (
    <section className="mt-10" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {seeAll && (
          <Link to={seeAll} className="shrink-0 text-sm font-medium text-orange-700 hover:underline">
            See all
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      <div className="scrollbar-none -mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {children}
      </div>
    </section>
  )
}

// Category, age, and themes as links into Search.
export function StoryTags({ story }: { story: CardStory }) {
  const chip = 'rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-stone-900'
  return (
    <div className="flex flex-wrap items-center gap-2">
      {story.category && (
        <Link to={`/search?category=${story.category}`} className={chip}>
          {categoryLabel(story.category)}
        </Link>
      )}
      {story.ageRange && (
        <Link to={`/search?age=${encodeURIComponent(story.ageRange)}`} className={chip}>
          Ages {story.ageRange}
        </Link>
      )}
      {story.themes?.map((theme) => (
        <Link key={theme} to={`/search?theme=${theme}`} className={chip}>
          #{themeLabel(theme)}
        </Link>
      ))}
    </div>
  )
}
