import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { AGE_RANGES, type AgeRange } from '../../convex/taxonomy'
import { PageHeader } from '../components/PageHeader'

const row = 'flex items-center justify-between px-5 py-4 hover:bg-stone-50'

export default function Account() {
  const me = useQuery(api.users.me)
  const setAgeRange = useMutation(api.users.setAgeRange)
  const { signOut } = useAuthActions()
  const navigate = useNavigate()

  if (!me) return <PageHeader title="Account" />

  return (
    <div className="max-w-2xl">
      <PageHeader title="Account" subtitle={me.email} />

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Reader's age</h2>
        <p className="mt-1 text-sm text-stone-500">
          Top Picks only suggests stories suitable for this age. Other sections still show every story with its age label.
        </p>
        <div role="radiogroup" aria-label="Reader's age" className="mt-4 flex flex-wrap gap-2">
          {[null, ...AGE_RANGES].map((age: AgeRange | null) => (
            <button
              key={age ?? 'any'}
              type="button"
              role="radio"
              aria-checked={me.ageRange === age}
              onClick={() => void setAgeRange({ ageRange: age })}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                me.ageRange === age ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 hover:border-stone-500'
              }`}
            >
              {age ?? 'All'}
            </button>
          ))}
        </div>
      </section>

      <nav aria-label="Account" className="mt-6 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <Link to="/mine" className={row}>
          Stories you've written <span aria-hidden>›</span>
        </Link>
        <Link to="/library" className={row}>
          Your library <span aria-hidden>›</span>
        </Link>
        {me.isAdmin && (
          <Link to="/review" className={row}>
            Review submissions <span aria-hidden>›</span>
          </Link>
        )}
        {me.isAdmin && (
          <Link to="/admin/illustrators" className={row}>
            Illustrators <span aria-hidden>›</span>
          </Link>
        )}
        <Link to="/map" className={row}>
          Story map <span aria-hidden>›</span>
        </Link>
      </nav>

      <button
        type="button"
        onClick={() => void signOut().then(() => navigate('/'))}
        className="mt-6 rounded-full border border-stone-300 px-5 py-2 text-sm font-medium hover:bg-stone-100"
      >
        Sign out
      </button>
    </div>
  )
}
