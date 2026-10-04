import { useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { HomeIcon, LibraryIcon, NewIcon, PlusIcon, SearchIcon } from './Icons'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/new', label: 'New', Icon: NewIcon, end: false },
  { to: '/library', label: 'Library', Icon: LibraryIcon, end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <TopBar />
      {/* Bottom padding keeps content clear of the floating tab bar on phones. */}
      <main className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6 md:pb-16 md:pt-10">{children}</main>
      <BottomBar />
    </div>
  )
}

function TopBar() {
  const me = useQuery(api.users.me)
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Story<span className="text-orange-600">Place</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
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
          {/* Writing a story is a separate action from "New" (newly published stories). */}
          <Link
            to="/write"
            className="flex items-center gap-1.5 rounded-full bg-orange-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
          >
            <PlusIcon className="h-4 w-4" />
            Add a Story
          </Link>
          {me === undefined ? (
            <span className="h-9 w-9" />
          ) : me === null ? (
            <Link to="/signin" className="text-sm font-medium text-stone-600 hover:text-stone-900">
              Sign in
            </Link>
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

// Phone navigation: Home, New, and Library in one bar, and Search in its own circle beside it.
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
