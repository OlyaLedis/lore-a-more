import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import coverTexture from '../assets/cover-texture.png'
import { useBackLink, usePageName } from '../backLink'
import { BackLink } from '../components/BackLink'
import { IllustratorCard } from '../components/IllustratorCard'
import { PinIcon } from '../components/Icons'
import { PlacesBanner } from '../components/PlacesBanner'
import { StoryCard } from '../components/StoryCard'
import { coverTint, linkName, usePageMeta } from '../illustrators'

// /illustrator/:slug — an artist's page within the storytelling app: who they are (About) and every
// published story they illustrated for Loramore (Stories), with other illustrators at the bottom.
export default function IllustratorPage() {
  const { slug = '' } = useParams()
  const profile = useQuery(api.illustrators.profile, { slug })
  // Back to where the reader came from (often a story); opened from a shared link, to the directory.
  const back = useBackLink({ to: '/illustrators', label: 'Illustrators' })
  usePageName(profile?.name)
  usePageMeta(
    profile
      ? {
          title: profile.name,
          description:
            profile.bio?.slice(0, 200) ??
            `Stories illustrated by ${profile.name} for Loramore, local legends tied to real places.`,
          image: profile.photoUrl ?? profile.stories.find((s) => s.cover)?.cover?.url ?? null,
        }
      : null,
  )

  if (profile === undefined) return <p className="text-stone-500">Loading…</p>
  if (profile === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">There's no illustrator at this address.</p>
        <Link to="/" className="mt-2 inline-block font-medium underline">
          Back to Home
        </Link>
      </div>
    )
  }

  // The banner: the artist's own cover picture, or the shared watercolour texture in their shade.
  const banner = profile.coverUrl ?? coverTexture
  const hasAbout = Boolean(profile.bio || profile.basedIn || profile.website || profile.links.length)

  return (
    <article>
      {/* A watercolour banner (the artist's cover picture, or the shared texture in their shade) that maps
          where their stories happen. It reaches past the page's side margins, so the portrait overlapping
          its lower edge sits a little in from its left edge at every width. Below the portrait: the name,
          the page's main focus, and one quiet line of profile details, "Illustrator · Based in …" (where
          the artist lives, never where their stories happen; those are the dots on the banner). */}
      <BackLink back={back} className="mb-3" />
      <header>
        <PlacesBanner
          image={banner}
          imageStyle={profile.coverUrl ? undefined : { filter: coverTint(profile.slug).filter }}
          places={profile.places}
          name={profile.name}
          className="-mx-4 h-36 sm:-mx-6 sm:h-52 lg:rounded-2xl"
        />
        {profile.photoUrl && (
          <img
            src={profile.photoUrl}
            alt={`Portrait of ${profile.name}`}
            className="relative -mt-14 h-28 w-28 rounded-full bg-stone-200 object-cover ring-[5px] ring-stone-50 sm:-mt-20 sm:h-40 sm:w-40"
          />
        )}
        <h1 className={`${profile.photoUrl ? 'mt-4' : 'mt-6'} text-3xl font-semibold leading-[1.1] tracking-tight text-stone-800 sm:text-4xl`}>
          {profile.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-stone-500">
          <span className="font-serif italic text-orange-700">Illustrator</span>
          {profile.basedIn && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <PinIcon className="h-3.5 w-3.5" />
                Based in {profile.basedIn}
              </span>
            </>
          )}
        </p>
      </header>

      <ProfileTabs
        defaultTab={hasAbout ? 'about' : 'stories'}
        about={<About profile={profile} />}
        stories={<Stories stories={profile.stories} />}
      />

      <MoreIllustrators slug={profile.slug} />
    </article>
  )
}

type Profile = NonNullable<FunctionReturnType<typeof api.illustrators.profile>>
type Tab = 'about' | 'stories'
const TABS: { id: Tab; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'stories', label: 'Stories' },
]

// About | Stories, as quiet underlined tabs. The open tab is kept in the address (#about, #stories), so it
// survives a reload and can be shared, without loading a new page.
function ProfileTabs({ defaultTab, about, stories }: { defaultTab: Tab; about: ReactNode; stories: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const fromHash = location.hash.slice(1)
  const tab: Tab = fromHash === 'about' || fromHash === 'stories' ? fromHash : defaultTab
  const open = (next: Tab) => navigate({ hash: next }, { replace: true, preventScrollReset: true })
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Profile" className="flex gap-7 border-b border-stone-200">
        {TABS.map(({ id, label }, i) => (
          <button
            key={id}
            ref={(el) => {
              buttons.current[id] = el
            }}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => open(id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id
              open(next)
              buttons.current[next]?.focus()
            }}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 ${
              tab === id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-7">
        {tab === 'about' ? about : stories}
      </div>
    </div>
  )
}

// The artist in their own words, where they're based, and where to see more of their work.
function About({ profile }: { profile: Profile }) {
  const paragraphs = (profile.bio ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const others = profile.links.map((url) => ({ url, name: linkName(url) }))
  return (
    <div className="max-w-2xl">
      {paragraphs.length > 0 ? (
        <div className="space-y-4 font-serif text-[1.2rem] leading-[1.45] text-stone-700 sm:text-[1.3rem]">
          {paragraphs.map((text, i) => (
            <p key={i} className="whitespace-pre-line">
              {text}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-stone-500">No biography yet.</p>
      )}
      {profile.basedIn && (
        <p className="mt-6 flex items-center gap-1.5 text-[15px] text-stone-600">
          <PinIcon className="h-4 w-4 text-stone-400" />
          Based in {profile.basedIn}
        </p>
      )}
      {(profile.website || others.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 font-semibold text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
            >
              See portfolio <span aria-hidden>↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {others.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Elsewhere">
              {others.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900 hover:decoration-stone-700"
                  >
                    {link.name}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Every published story the artist illustrated, as cards: picture, title, and where it happens. Large, so
// the artwork leads: one column on a phone (below 600px), two on a tablet, three from 1024px, where the
// page's column is about 980px wide and each picture still gets some 300px.
function Stories({ stories }: { stories: Profile['stories'] }) {
  if (stories.length === 0) return <p className="text-stone-500">No published stories yet.</p>
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 min-[600px]:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard key={story._id} story={story} wide />
      ))}
    </div>
  )
}

// Other artists, a quiet secondary section after the stories: small portraits that scroll sideways on a
// phone (about two and a half in view) and sit in one row on wider screens, then a link to them all.
// Hidden when there's no one else to show.
function MoreIllustrators({ slug }: { slug: string }) {
  const others = useQuery(api.illustrators.others, { slug, count: 6 })
  if (!others || others.illustrators.length === 0) return null
  return (
    <section aria-labelledby="more-heading" className="mt-6 border-t border-stone-200 pt-5">
      <h2 id="more-heading" className="text-base font-semibold text-stone-600">
        More Illustrators
      </h2>
      <ul className="scrollbar-none -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-6 sm:overflow-visible sm:px-0">
        {others.illustrators.map((illustrator) => (
          <li key={illustrator._id} className="w-[38%] shrink-0 snap-start sm:w-auto">
            <IllustratorCard illustrator={illustrator} small />
          </li>
        ))}
      </ul>
      <Link to="/illustrators" className="mt-3 inline-block text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline">
        View all illustrators →
      </Link>
    </section>
  )
}
