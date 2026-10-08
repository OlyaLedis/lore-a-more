// Links to a story: /story/<code>/<title-slug>, e.g. /story/SP-7K3QX9/giant-of-eppstein. Only the code
// identifies the story (see convex/storyCodes.ts); the title part is for people and may go out of date
// when a story is renamed, so the story page puts the current one back. Stories without a code yet
// fall back to their database id, which still works.
type Linkable = { _id: string; code?: string; title?: string }

// Words used by other story pages (/story/<code>/read, /edit) can't be a title slug.
const RESERVED = new Set(['read', 'edit'])

export function titleSlug(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return RESERVED.has(slug) ? `${slug}-story` : slug
}

export function storyKey(story: Linkable) {
  return story.code ?? story._id
}

export function storyPath(story: Linkable) {
  const slug = story.title ? titleSlug(story.title) : ''
  return `/story/${storyKey(story)}${slug ? `/${slug}` : ''}`
}

export function readPath(story: Linkable) {
  return `/story/${storyKey(story)}/read`
}

export function editPath(story: Linkable) {
  return `/story/${storyKey(story)}/edit`
}
