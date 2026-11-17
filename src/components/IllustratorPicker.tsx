import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { CloseIcon } from './Icons'

// Admins only, on the story page: who illustrated this story, in credit order. Changes save at once and
// show in the credit above and in each illustrator's gallery.
export function IllustratorPicker({ storyId }: { storyId: Id<'stories'> }) {
  const credits = useQuery(api.illustrators.forStory, { storyId })
  const all = useQuery(api.illustrators.list, {})
  const setForStory = useMutation(api.illustrators.setForStory)
  const [error, setError] = useState<string | null>(null)

  if (!credits || !all) return null
  const assigned = new Set(credits.map((c) => c._id))
  const others = all.filter((i) => !assigned.has(i._id))

  const save = async (ids: Id<'illustrators'>[]) => {
    setError(null)
    try {
      await setForStory({ storyId, illustratorIds: ids })
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'That didn’t save. Try again.')
    }
  }

  return (
    <section aria-labelledby="illustrators-heading" className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="illustrators-heading" className="text-sm font-semibold text-stone-700">
          Illustrators <span className="font-normal text-stone-500">(admin)</span>
        </h2>
        <Link to="/admin/illustrators" className="text-sm text-stone-500 underline-offset-4 hover:underline">
          Manage illustrators
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {credits.map((c) => (
          <span key={c._id} className="inline-flex items-center gap-1 rounded-full border border-stone-300 py-1 pl-3 pr-1 text-sm">
            {c.name}
            <button
              type="button"
              onClick={() => void save(credits.filter((x) => x._id !== c._id).map((x) => x._id))}
              aria-label={`Remove ${c.name}`}
              className="rounded-full p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {others.length > 0 ? (
          <select
            id="add-illustrator"
            aria-label="Add an illustrator"
            value=""
            onChange={(e) => e.target.value && void save([...credits.map((c) => c._id), e.target.value as Id<'illustrators'>])}
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
          >
            <option value="">Add an illustrator…</option>
            {others.map((i) => (
              <option key={i._id} value={i._id}>
                {i.name}
              </option>
            ))}
          </select>
        ) : (
          all.length === 0 && (
            <p className="text-sm text-stone-500">
              No illustrators yet. <Link to="/admin/illustrators" className="underline underline-offset-4">Add one</Link>.
            </p>
          )
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
