import { MAP_CATEGORIES, type MapCategory } from '../mapStories'

// A story's type as a serif-italic phrase in its type's ink colour ("A wonder tale"), the same on the
// map's story sheet and the story page. Stories with a retired type show nothing here.
export function TypePhrase({ category, className = 'text-sm' }: { category: MapCategory | null; className?: string }) {
  const type = MAP_CATEGORIES.find((c) => c.id === category)
  if (!type) return null
  return (
    <span className={`font-serif italic ${className}`} style={{ color: type.ink }}>
      {type.phrase}
    </span>
  )
}
