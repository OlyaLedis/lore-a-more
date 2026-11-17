import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { IllustratorCard } from '../components/IllustratorCard'
import { PageHeader } from '../components/PageHeader'
import { usePageMeta } from '../illustrators'

// /illustrators — every artist with a published story. Reached from profiles ("View all illustrators")
// and from Search, not from the main navigation.
export default function IllustratorsPage() {
  const all = useQuery(api.illustrators.directory, {})
  usePageMeta({ title: 'Illustrators', description: 'The artists who illustrate Loramore’s local legends.' })
  return (
    <div>
      <PageHeader title="Illustrators" subtitle="The artists who bring Loramore’s stories to life." />
      {all === undefined ? (
        <p className="text-stone-500">Loading…</p>
      ) : all.length === 0 ? (
        <p className="text-stone-500">No illustrators yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {all.map((illustrator) => (
            <li key={illustrator._id}>
              <IllustratorCard illustrator={illustrator} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
