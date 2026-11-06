import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// After the story: the beings in it as their tradition tells them, for the grown-up telling it. What
// people believed, questions to ask the listener, and where it all comes from. See convex/characters.ts.
export function CharacterCards({ storyId }: { storyId: Id<'stories'> }) {
  const cards = useQuery(api.characters.forStory, { storyId })
  if (!cards?.length) return null
  return (
    <>
      {cards.map((card) => (
        <aside key={card._id} aria-label={`Meet the character: ${card.name}`} className="mt-12 rounded-2xl bg-stone-50 p-6 ring-1 ring-stone-200 sm:p-8">
          <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">Meet the character</p>
          <h2 className="mt-2 font-serif text-2xl text-stone-900">{card.name}</h2>
          <p className="mt-1 font-serif text-stone-600 italic">{card.localName}</p>

          {card.beliefs.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold text-stone-700">What people believed</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-stone-700">
                {card.beliefs.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </>
          )}

          {card.questions.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold text-stone-700">Ask your listener</h3>
              <ul className="mt-2 space-y-2 text-stone-700">
                {card.questions.map((text) => (
                  <li key={text} className="flex gap-3">
                    <span aria-hidden className="font-serif text-lg leading-6 text-orange-700">?</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-6 text-sm text-stone-500">
            {card.region} · From {card.sources.join('; ')}
          </p>
        </aside>
      ))}
    </>
  )
}
