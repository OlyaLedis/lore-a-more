import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'

export default function SignIn() {
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const location = useLocation()
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Where to go after signing in: the page they came from (a chosen place is kept separately, so
  // Home shows it again), or the action that needed an account, such as Add a Story.
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (isAuthenticated) return <Navigate to={from} replace />

  const switchTo = (next: 'signIn' | 'signUp') => {
    setFlow(next)
    setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    formData.set('flow', flow)
    try {
      await signIn('password', formData)
    } catch {
      setError(
        flow === 'signIn'
          ? 'Wrong email or password.'
          : 'Could not create the account. The email may already be registered.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">
        {flow === 'signIn' ? 'Sign In' : 'Create an account'}
      </h1>
      <p className="mt-2 text-stone-500">
        {flow === 'signIn'
          ? 'Sign in to save stories and add your own.'
          : 'Save stories you love and share the stories of your places.'}
      </p>
      {flow === 'signIn' && (
        <p className="mt-5 rounded-2xl bg-orange-50 px-4 py-3 text-stone-800 ring-1 ring-orange-200">
          New to Loramore?{' '}
          <button type="button" onClick={() => switchTo('signUp')} className="font-semibold text-orange-800 underline">
            Create an account
          </button>
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            className={inputClass}
            name="password"
            type="password"
            minLength={8}
            autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
            required
          />
          {flow === 'signUp' && (
            <span className="mt-1 block text-xs text-stone-500">At least 8 characters.</span>
          )}
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-stone-900 py-2 font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {submitting ? 'One moment…' : flow === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      {flow === 'signUp' && (
        <p className="mt-4 text-sm text-stone-600">
          Already have an account?{' '}
          <button type="button" onClick={() => switchTo('signIn')} className="font-semibold text-stone-900 underline">
            Sign in
          </button>
        </p>
      )}
      <p className="mt-8 border-t border-stone-200 pt-4 text-sm text-stone-500">
        You can read every story without an account.{' '}
        <Link to={from} className="font-medium text-stone-700 underline">
          Keep browsing
        </Link>
      </p>
    </div>
  )
}
