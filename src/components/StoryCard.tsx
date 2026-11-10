import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Id } from '../../convex/_generated/dataModel'
import {
  categoryOne,
  themeLabel,
  type AgeRange,
  type StoredCategory,
  type StoredTheme,
} from '../../convex/taxonomy'
import { coverColor } from '../mapStories'
import { PinIcon } from './Icons'
import { storyPath } from '../storyLinks'

export type CardStory = {
  _id: Id<'stories'>
  // Permanent code used in links (see storyLinks.ts).
  code?: string
  title: string
  author?: string
  category?: StoredCategory
  ageRange?: AgeRange
  themes?: StoredTheme[]
  place?: string
  // The cover picture and its framing, or null/absent for the colorful category cover.
  cover?: CardCover | null
}

// A cover picture as cards show it. `scale` and `x`/`y` are display settings, never a crop.
export type CardCover = { url: string; scale: number; x: number; y: number }

// The age symbol below each cover: a colorful shape showing only "6+", "8+", or "10+".
const ageColors: Record<AgeRange, string> = {
  '6+': 'bg-emerald-700',
  '8+': 'bg-sky-700',
  '10+': 'bg-violet-700',
}

export function AgeSymbol({ age, large = false }: { age: AgeRange; large?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`For ${age.replace('+', '')} and up`}
      className={`inline-flex shrink-0 items-center justify-center rounded-[0.8rem_0.8rem_0.8rem_0.25rem] font-extrabold tabular-nums text-white ${
        ageColors[age]
      } ${large ? 'h-8 min-w-11 px-2.5 text-base' : 'h-6 min-w-9 px-2 text-[13px]'}`}
    >
      {age}
    </span>
  )
}

// "Castello di Monreale, Sàrdara/Sardara, Italy" → "Castello di Monreale". Cards stay one line; the
// full place is on the story page and in the card's tooltip.
function shortPlace(place: string) {
  const [first, second] = place.split(',').map((p) => p.trim())
  return second && `${first}, ${second}`.length <= 18 ? `${first}, ${second}` : first
}

function cardDescription(story: CardStory, note?: string) {
  return [story.title, story.ageRange && `for ${story.ageRange.replace('+', '')} and up`, story.place, note]
    .filter(Boolean)
    .join(', ')
}

const cardFocus =
  'focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-orange-600'

// Without an illustration, a cover takes its category's map-dot colour (coverColor), fading lighter
// towards the corner, so a card and its dot on the map match. Stories from before categories get a
// neutral cover.
function colorCover(category: StoredCategory | undefined) {
  const color = coverColor(category)
  return { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, white))` }
}

// The square cover, the same everywhere a story appears. It never carries text: the title,
// category, and age sit below it. A picture fills the rounded square edge to edge (a picture that
// isn't square is trimmed at its sides on the card, never in the saved file), then scaled and moved
// by the author's settings. Without a picture, the category's colors and a soft circle.
export function StoryCover({
  category,
  cover,
  tag,
  wideOnPhone = false,
  className = '',
}: {
  category?: StoredCategory
  cover?: CardCover | null
  // A small story-type label in the corner, used only on the large featured cover.
  tag?: string
  // The featured cover on a phone: 3:2 instead of square when there's no picture, so the story's title
  // shows without scrolling. Pictures stay square, as their authors framed them.
  wideOnPhone?: boolean
  className?: string
}) {
  const tagLabel = tag && (
    <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-sm ring-1 ring-stone-900/10 sm:left-4 sm:top-4">
      {tag}
    </span>
  )
  if (cover) {
    return (
      <div className={`relative aspect-square overflow-hidden rounded-2xl bg-paper ring-1 ring-stone-900/10 ${className}`}>
        {tagLabel}
        <img
          src={cover.url}
          alt=""
          loading="lazy"
          draggable={false}
          // Multiplied onto the ivory paper, so a picture's white paper turns ivory.
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
          style={{ transform: `translate(${cover.x * 100}%, ${cover.y * 100}%) scale(${cover.scale})` }}
        />
      </div>
    )
  }
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${wideOnPhone ? 'aspect-[3/2] sm:aspect-square' : 'aspect-square'} ${className}`}
      style={colorCover(category)}
    >
      {tagLabel}
      {/* A soft circle for depth; purely decorative. On the wide cover it's smaller, so it stays round. */}
      <div
        className={`pointer-events-none absolute aspect-square rounded-full bg-white/25 ${
          wideOnPhone
            ? '-right-[12%] -top-[33%] w-[62%] sm:-right-[22%] sm:-top-[22%] sm:w-[85%]'
            : '-right-[22%] -top-[22%] w-[85%]'
        }`}
      />
    </div>
  )
}

// The card's content, without the link: used by StoryCard and by previews in the story form.
// Every line has a fixed height, so cards in a row line up however long their titles or places are.
export function StoryCardBody({ story, note }: { story: CardStory; note?: string }) {
  return (
    <>
      <StoryCover
        category={story.category}
        cover={story.cover}
        className="transition group-hover:brightness-105 group-hover:ring-stone-400"
      />
      <p className="mt-3 line-clamp-2 h-[2.6em] font-serif text-[17px] font-semibold leading-[1.3] text-stone-900 group-hover:underline sm:text-lg">
        {story.title}
      </p>
      <div className="mt-1.5 flex h-6 items-center gap-2">
        {story.ageRange && <AgeSymbol age={story.ageRange} />}
        {story.place && (
          <span className="flex min-w-0 items-center gap-1 text-[13px] text-stone-500">
            <PinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{shortPlace(story.place)}</span>
          </span>
        )}
      </div>
      {note && <p className="mt-1 h-5 truncate text-[13px] font-medium leading-5 text-orange-700">{note}</p>}
    </>
  )
}

// A story wherever stories are listed. Small in sideways rows; `wide` fills a grid cell.
export function StoryCard({ story, note, wide = false }: { story: CardStory; note?: string; wide?: boolean }) {
  return (
    <Link
      to={storyPath(story)}
      aria-label={cardDescription(story, note)}
      title={story.place ? `${story.title} · ${story.place}` : story.title}
      className={`group block shrink-0 snap-start rounded-2xl ${cardFocus} ${wide ? 'w-full' : 'w-40 sm:w-48'}`}
    >
      <StoryCardBody story={story} note={note} />
    </Link>
  )
}

// One story given the room of a whole section: a large cover with a large title beside it on wider
// screens, or above it on a phone.
export function FeaturedStoryCard({ story, note }: { story: CardStory; note?: string }) {
  return (
    <Link
      to={storyPath(story)}
      aria-label={cardDescription(story, note)}
      className={`group flex flex-col gap-3 rounded-3xl sm:flex-row sm:items-center sm:gap-8 ${cardFocus}`}
    >
      <StoryCover
        category={story.category}
        cover={story.cover}
        tag={story.category && categoryOne(story.category)}
        wideOnPhone
        className="w-full shrink-0 transition group-hover:brightness-105 sm:w-72 md:w-80"
      />
      <div className="min-w-0">
        {note && <p className="text-sm font-semibold text-orange-700">{note}</p>}
        <p className="mt-1 line-clamp-3 font-serif text-[1.75rem] font-bold leading-tight text-stone-900 group-hover:underline sm:text-4xl">
          {story.title}
        </p>
        <div className="mt-3 flex items-center gap-3">
          {story.ageRange && <AgeSymbol age={story.ageRange} large />}
          {story.place && (
            <span className="flex min-w-0 items-center gap-1.5 text-stone-600">
              <PinIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{story.place}</span>
            </span>
          )}
        </div>
        <span className="mt-5 inline-flex rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white group-hover:bg-stone-700">
          Read the story
        </span>
      </div>
    </Link>
  )
}

// A Home section: heading, optional subtitle and "See all", then its stories in any layout.
export function Section({
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
    <section className="mt-12" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-stone-700 sm:text-2xl">{title}</h2>
        {seeAll && (
          <Link to={seeAll} className="shrink-0 text-sm font-medium text-orange-700 hover:underline">
            See all
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

// Small cards in a row that scrolls sideways. The row sits inside the page gutter (no negative
// margins), so the first card, its caption, and the snap points all start on the page's left edge.
export function CardRow({ children }: { children: ReactNode }) {
  return <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">{children}</div>
}

// A titled row of small cards.
export function Shelf({ children, ...section }: Omit<Parameters<typeof Section>[0], 'children'> & { children: ReactNode }) {
  return (
    <Section {...section}>
      <CardRow>{children}</CardRow>
    </Section>
  )
}

// Two larger cards side by side.
export function TwoCardGrid({ stories }: { stories: CardStory[] }) {
  return (
    <div className="grid max-w-xl grid-cols-2 gap-4 sm:gap-6">
      {stories.slice(0, 2).map((story) => (
        <StoryCard key={story._id} story={story} wide />
      ))}
    </div>
  )
}

// Category, age, and themes as links into Search.
// Under the story page's title: the age symbol and the topics, in the map story sheet's style (quiet
// text joined by dots), each a link to Search. The story type sits above the title (TypePhrase).
export function StoryTags({ story }: { story: Pick<CardStory, 'ageRange' | 'themes'> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
      {story.ageRange && (
        <Link to={`/search?age=${encodeURIComponent(story.ageRange)}`} className="rounded-full hover:opacity-90">
          <AgeSymbol age={story.ageRange} />
        </Link>
      )}
      {story.themes && story.themes.length > 0 && (
        <p>
          {story.themes.map((theme, i) => (
            <span key={theme}>
              {i > 0 && ' · '}
              <Link to={`/search?theme=${theme}`} className="underline-offset-2 hover:text-stone-900 hover:underline">
                {themeLabel(theme)}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
