import { useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { illustratorPath, joinNames } from '../illustrators'

// "Illustrated by Anna and Ben", each name linking to the artist's profile. Nothing when no illustrator
// is assigned. `className` sets the line's own type; the names are underlined on hover.
export function IllustratorCredit({ storyId, className = '' }: { storyId: Id<'stories'>; className?: string }) {
  const credits = useQuery(api.illustrators.forStory, { storyId })
  if (!credits || credits.length === 0) return null
  return (
    <p className={className}>
      Illustrated by{' '}
      {joinNames(credits, (c) => (
        <Link key={c._id} to={illustratorPath(c)} className="font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current">
          {c.name}
        </Link>
      ))}
    </p>
  )
}
