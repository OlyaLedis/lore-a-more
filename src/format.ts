export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function byline(author: string | undefined) {
  return author ?? 'Anonymous'
}
