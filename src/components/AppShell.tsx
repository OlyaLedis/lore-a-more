import { useConvexAuth, useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { useSelectedPlace } from '../selectedPlace'
import { HomeIcon, LibraryIcon, MapIcon, PlusIcon, SearchIcon } from './Icons'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon, end: false },
  { to: '/library', label: 'Library', Icon: LibraryIcon, end: false },
]

// A signed-out visitor who hasn't chosen a place yet sees a clean opening screen: just the logo and
// Sign In, no tabs and no bottom bar.
function useOpeningScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { place } = useSelectedPlace()
  const { pathname } = useLocation()
  return pathname === '/' && !place && !isLoading && !isAuthenticated
}

export function AppShell({ children }: { children: ReactNode }) {
  const opening = useOpeningScreen()
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <TopBar opening={opening} />
      {/* Bottom padding keeps content clear of the floating tab bar on phones. */}
      <main className={`mx-auto max-w-5xl px-4 pt-6 sm:px-6 md:pb-16 md:pt-10 ${opening ? 'pb-8' : 'pb-32'}`}>{children}</main>
      {!opening && <BottomBar />}
    </div>
  )
}

function TopBar({ opening }: { opening: boolean }) {
  const me = useQuery(api.users.me)
  const location = useLocation()
  // Signing in returns here, including any query string.
  const here = location.pathname + location.search
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Story<span className="text-orange-600">Place</span>
        </Link>

        <nav aria-label="Main" className={opening ? 'hidden' : 'hidden items-center gap-1 md:flex'}>
          {[...tabs, { to: '/search', label: 'Search', Icon: SearchIcon, end: false }].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          {me?.isAdmin && (
            <NavLink
              to="/review"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium ${
                  isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-200/60'
                }`
              }
            >
              Review
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {/* Signed in only: a quiet secondary action, since visitors mainly come to read. */}
          {me && (
            <Link
              to="/write"
              className="flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-500 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 sm:text-sm"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add a Story
            </Link>
          )}
          {me === undefined ? (
            <span className="h-9 w-9" />
          ) : me === null ? (
            location.pathname === '/signin' ? null : (
              <Link
                to="/signin"
                state={{ from: here }}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
              >
                Sign In
              </Link>
            )
          ) : (
            <NavLink
              to="/account"
              aria-label={`Account (${me.email ?? 'signed in'})`}
              title={me.email}
              className={({ isActive }) =>
                `flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ring-offset-2 ring-offset-stone-50 ${
                  isActive ? 'bg-stone-900 ring-2 ring-stone-900' : 'bg-stone-700 hover:bg-stone-900'
                }`
              }
            >
              {initials(me.email)}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}

// Phone navigation: Home, Map, and Library in one bar, and Search in its own circle beside it.
function BottomBar() {
  const surface = 'border border-stone-200/80 bg-white/90 shadow-lg shadow-stone-900/10 backdrop-blur'
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <nav aria-label="Main" className={`grid flex-1 grid-cols-3 rounded-full p-1.5 ${surface}`}>
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-stone-500 hover:text-stone-900'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink
          to="/search"
          aria-label="Search"
          className={({ isActive }) =>
            `flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full ${surface} ${
              isActive ? 'text-orange-700 ring-2 ring-orange-600' : 'text-stone-600'
            }`
          }
        >
          <SearchIcon className="h-6 w-6" />
        </NavLink>
      </div>
    </div>
  )
}

// "olga.ledis@…" → "OL", "sam@…" → "SA". Accounts only have an email, so initials come from it.
function initials(email: string | undefined) {
  const name = (email ?? '?').split('@')[0]
  const parts = name.split(/[._\-+]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return letters.toUpperCase() || '?'
}
