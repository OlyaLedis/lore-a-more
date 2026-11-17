import { Link } from 'react-router-dom'
import { illustratorPath } from '../illustrators'

type Card = { _id: string; slug: string; name: string; photoUrl: string | null; storyCount?: number }

// An illustrator as a small portrait in a circle with their name below, linking to their profile. Without
// a picture, the circle shows their initial.
export function IllustratorCard({ illustrator, small = false }: { illustrator: Card; small?: boolean }) {
  const size = small ? 'h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] text-xl' : 'h-28 w-28 sm:h-32 sm:w-32 text-3xl'
  return (
    <Link
      to={illustratorPath(illustrator)}
      className="group flex flex-col items-center rounded-2xl p-2 text-center focus-visible:outline-2 focus-visible:outline-orange-600"
    >
      {illustrator.photoUrl ? (
        <img
          src={illustrator.photoUrl}
          alt=""
          loading="lazy"
          className={`${size} rounded-full bg-stone-200 object-cover ring-1 ring-stone-900/10 transition group-hover:ring-stone-400`}
        />
      ) : (
        <span aria-hidden className={`${size} inline-flex items-center justify-center rounded-full bg-stone-200 font-semibold text-stone-500`}>
          {illustrator.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className={`font-medium text-stone-800 group-hover:underline ${small ? 'mt-2 text-[13px] leading-tight' : 'mt-3 leading-snug'}`}>{illustrator.name}</span>
      {illustrator.storyCount !== undefined && (
        <span className={`mt-0.5 text-stone-400 ${small ? 'text-xs' : 'text-sm'}`}>
          {illustrator.storyCount} {illustrator.storyCount === 1 ? 'story' : 'stories'}
        </span>
      )}
    </Link>
  )
}
