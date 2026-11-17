// A back link that says where it goes ("← Map", "← Kwame Asante-Lind", "← The Giant of Eppstein"), on
// every page that isn't a tab. The tab's pages are recorded by their place in the browser history (React
// Router's `idx`), kept in sessionStorage so a refresh keeps them. A page replacing its own address
// (sign-in, a story's canonical link) takes the same place, so it never counts as a step back.
//
// - With a page before it in the tab, the link goes back (the browser's own Back, so scroll positions and
//   the map's view come back too), named by that page's own name (`usePageName`: a story's title, an
//   artist's name, "Stories in Eppstein") or else by its address (`NAMES`).
// - With none (a shared link opened directly, a new tab), it goes to the page's parent instead (`fallback`:
//   a profile to Illustrators, My stories to Account…), so the installed app, which has no browser Back
//   button, never leaves a reader stuck.
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const KEY = 'storyplace.pages'

type Page = { path: string; name?: string }

function historyIndex(): number | null {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

function readPages(): Record<number, Page | string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<number, Page | string>
  } catch {
    return {}
  }
}

// Pages recorded before names existed were plain paths.
function pageAt(pages: Record<number, Page | string>, idx: number): Page | null {
  const page = pages[idx]
  if (!page) return null
  return typeof page === 'string' ? { path: page } : page
}

function writePage(idx: number, page: Page) {
  const pages = readPages()
  pages[idx] = page
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pages))
  } catch {
    // Not remembered; back links fall back to the page's address, or "Back".
  }
}

// In AppShell: remember which page is at each place in this tab's history. A page's own name (set by
// `usePageName`, whose effect runs first, being deeper in the tree) is kept while the address is the same.
export function useRecordPages() {
  const { pathname } = useLocation()
  useEffect(() => {
    const idx = historyIndex()
    if (idx === null) return
    if (pageAt(readPages(), idx)?.path === pathname) return
    writePage(idx, { path: pathname })
  }, [pathname])
}

// On a page with a name of its own (a story, an artist, "Stories in Eppstein"): what the next page's back
// link calls it. Nothing is recorded until the name is known.
export function usePageName(name: string | null | undefined) {
  const { pathname } = useLocation()
  useEffect(() => {
    const idx = historyIndex()
    if (idx === null || !name) return
    writePage(idx, { path: pathname, name })
  }, [name, pathname])
}

// The app's pages by address, for pages without a name of their own. First match wins.
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
  [/^\/illustrators$/, 'Illustrators'],
  [/^\/admin\/illustrators$/, 'Illustrators'],
  [/^\/illustrator\//, 'Illustrator'],
  [/^\/story\/[^/]+\/read$/, 'Story'],
  [/^\/story\/[^/]+\/edit$/, 'Edit Story'],
  [/^\/story\//, 'Story'],
  [/^\/write$/, 'Add a Story'],
]

// Long names (story titles) are cut at a word, so the link stays one short line.
const MAX_LABEL = 36
export function shortLabel(name: string) {
  if (name.length <= MAX_LABEL) return name
  const cut = name.slice(0, MAX_LABEL)
  const space = cut.lastIndexOf(' ')
  return `${(space > 12 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, '')}…`
}

// The page before this one in the tab, or null when there's none (a link opened directly, a new tab).
export function previousPage(): string | null {
  const idx = historyIndex()
  if (!idx) return null
  return pageAt(readPages(), idx - 1)?.path ?? null
}

export type BackLink = { label: string; go: () => void }
export type BackFallback = { to: string; label: string }

export function useBackLink(fallback?: BackFallback | null): BackLink | null {
  const navigate = useNavigate()
  useLocation() // re-read on every navigation
  const idx = historyIndex()
  if (idx) {
    const previous = pageAt(readPages(), idx - 1)
    const name = previous
      ? (previous.name ?? NAMES.find(([pattern]) => pattern.test(previous.path))?.[1])
      : undefined
    return { label: shortLabel(name ?? 'Back'), go: () => navigate(-1) }
  }
  if (!fallback) return null
  return { label: shortLabel(fallback.label), go: () => navigate(fallback.to) }
}
