import { useEffect, type ReactNode } from 'react'

// Illustrator profiles live at /illustrator/<slug>; the slug is set once and never changes (see
// convex/illustrators.ts), so a profile link can be shared for good.
export function illustratorPath(illustrator: { slug: string }) {
  return `/illustrator/${illustrator.slug}`
}

// A link's name from its address: "https://www.instagram.com/olga" → "Instagram". Unknown sites show
// their own name ("olga-draws.com").
const SITES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)behance\.net$/, 'Behance'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)dribbble\.com$/, 'Dribbble'],
  [/(^|\.)artstation\.com$/, 'ArtStation'],
  [/(^|\.)(x|twitter)\.com$/, 'X'],
  [/(^|\.)facebook\.com$/, 'Facebook'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
  [/(^|\.)bsky\.app$/, 'Bluesky'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)youtube\.com$/, 'YouTube'],
  [/(^|\.)vimeo\.com$/, 'Vimeo'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest'],
  [/(^|\.)tumblr\.com$/, 'Tumblr'],
  [/(^|\.)etsy\.com$/, 'Etsy'],
  [/(^|\.)substack\.com$/, 'Substack'],
  [/(^|\.)patreon\.com$/, 'Patreon'],
]

export function linkName(url: string) {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
  return SITES.find(([pattern]) => pattern.test(host))?.[1] ?? host
}

// "Anna", "Anna and Ben", "Anna, Ben and Cleo".
export function joinNames<T>(items: T[], render: (item: T) => ReactNode) {
  return items.flatMap((item, i) => [
    i === 0 ? null : i === items.length - 1 ? ' and ' : ', ',
    render(item),
  ])
}

const DEFAULT_TITLE = 'Loramore'

function setMeta(attribute: 'name' | 'property', key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (content === null) {
    tag?.remove()
    return
  }
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

// The page's title, description, and sharing preview while it's open (search engines that run the page
// read these; link previews in chat apps get them from the server, see api/illustrator.ts).
export function usePageMeta(meta: { title: string; description?: string; image?: string | null } | null) {
  const title = meta?.title
  const description = meta?.description
  const image = meta?.image
  useEffect(() => {
    if (!title) return
    document.title = `${title} · Loramore`
    setMeta('name', 'description', description ?? null)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description ?? null)
    setMeta('property', 'og:image', image ?? null)
    setMeta('property', 'og:type', 'profile')
    return () => {
      document.title = DEFAULT_TITLE
      for (const key of ['og:title', 'og:description', 'og:image', 'og:type']) setMeta('property', key, null)
      setMeta('name', 'description', null)
    }
  }, [title, description, image])
}

// The shared watercolour banner (src/assets/cover-texture.png) in a shade of its own for each artist,
// picked from their profile's slug so it never changes: one family of pages that still tell apart.
// An artist's own cover picture is shown as it is.
export const COVER_TINTS = [
  { name: 'blue', filter: 'none' },
  { name: 'teal', filter: 'hue-rotate(-28deg) saturate(.75)' },
  { name: 'sage green', filter: 'hue-rotate(-75deg) saturate(.5) brightness(1.04)' },
  { name: 'ochre', filter: 'hue-rotate(-170deg) saturate(.65) brightness(1.06)' },
  { name: 'terracotta', filter: 'hue-rotate(160deg) saturate(.6) brightness(1.03)' },
  { name: 'rose', filter: 'hue-rotate(125deg) saturate(.45) brightness(1.06)' },
  { name: 'violet', filter: 'hue-rotate(50deg) saturate(.5) brightness(1.04)' },
  { name: 'ink grey', filter: 'grayscale(1) brightness(1.1) contrast(.9)' },
]

export function coverTint(slug: string) {
  let hash = 0
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COVER_TINTS[hash % COVER_TINTS.length]
}
