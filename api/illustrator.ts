// Link previews for illustrator profiles. The app is a single page that fills itself in with JavaScript,
// which chat apps and social sites don't run, so a shared /illustrator/<slug> link would show only
// "Loramore". vercel.json sends those links here: this reads the profile from Convex and returns the
// app's own page with the artist's name, bio, and picture in its title and sharing tags. The app then
// starts as usual. In the installed app the service worker serves the page itself, so this isn't used.

type Profile = { name: string; slug: string; bio: string | null; photoUrl: string | null; stories: { cover: { url: string } | null }[] }

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

async function profileOf(convexUrl: string, slug: string): Promise<Profile | null> {
  try {
    const response = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'illustrators:profile', args: { slug }, format: 'json' }),
    })
    const body = (await response.json()) as { status: string; value?: Profile | null }
    return body.status === 'success' ? (body.value ?? null) : null
  } catch {
    return null
  }
}

// The page's tags for a profile, or null to leave the page as it is.
export function previewTags(profile: Profile, pageUrl: string) {
  const title = `${profile.name}, illustrator · Loramore`
  const description = (profile.bio ?? `Stories illustrated by ${profile.name} for Loramore: local legends tied to real places.`)
    .replace(/\s+/g, ' ')
    .slice(0, 200)
  const image = profile.photoUrl ?? profile.stories.find((s) => s.cover)?.cover?.url ?? null
  return [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<link rel="canonical" href="${escape(pageUrl)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="Loramore" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${escape(pageUrl)}" />`,
    image ? `<meta property="og:image" content="${escape(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = (url.searchParams.get('slug') ?? '').toLowerCase()
  const page = await fetch(new URL('/index.html', url.origin))
  let html = await page.text()
  const convexUrl = html.match(/<meta name="convex-url" content="(https:\/\/[^"]+)"/)?.[1]
  const profile = convexUrl && /^[a-z0-9-]{1,80}$/.test(slug) ? await profileOf(convexUrl, slug) : null
  if (profile) {
    const tags = previewTags(profile, new URL(`/illustrator/${profile.slug}`, url.origin).toString())
    html = html.replace(/<title>[^<]*<\/title>/, '').replace('</head>', `    ${tags}\n  </head>`)
  }
  return new Response(html, {
    status: page.ok ? 200 : 502,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
  })
}
