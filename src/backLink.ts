// A back link that says where it goes ("← Map", "← Search"), for pages people arrive at from
// elsewhere in the app (a story, the story form). The tab's pages are recorded by their place in the
// browser history (React Router's `idx`), kept in sessionStorage so a refresh keeps them. A page
// replacing its own address (sign-in, a story's canonical link) takes the same place, so it never
// counts as a step back.
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const KEY = 'storyplace.pages'

function historyIndex(): number | null {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

function readPages(): Record<number, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<number, string>
  } catch {
    return {}
  }
}

// In AppShell: remember which page is at each place in this tab's history.
export function useRecordPages() {
  const { pathname } = useLocation()
  useEffect(() => {
    const idx = historyIndex()
    if (idx === null) return
    const pages = readPages()
    pages[idx] = pathname
    try {
      sessionStorage.setItem(KEY, JSON.stringify(pages))
    } catch {
      // Not remembered; back links fall back to "Back".
    }
  }, [pathname])
}

// The app's pages by name, for the back link's label.
const NAMES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/map$/, 'Map'],
  [/^\/search$/, 'Search'],
  [/^\/library$/, 'Library'],
  [/^\/new$/, 'New stories'],
  [/^\/mine$/, 'My stories'],
  [/^\/review$/, 'Review'],
  [/^\/place\//, 'Stories'],
  [/^\/account$/, 'Account'],
]

// The page before this one in the tab, or null when there's none (a link opened directly, a new tab):
// the logo is the way home then.
export function previousPage(): string | null {
  const idx = historyIndex()
  if (!idx) return null
  return readPages()[idx - 1] ?? null
}

export function useBackLink(): { label: string; go: () => void } | null {
  const navigate = useNavigate()
  useLocation() // re-read on every navigation
  const previous = previousPage()
  const idx = historyIndex()
  if (!idx) return null
  const name = previous ? NAMES.find(([pattern]) => pattern.test(previous))?.[1] : undefined
  return { label: name ?? 'Back', go: () => navigate(-1) }
}
