import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'

export default function SignIn() {
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const location = useLocation()
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (isAuthenticated) return <Navigate to={from} replace />

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
      <h1 className="font-serif text-3xl font-bold">
        {flow === 'signIn' ? 'Sign in' : 'Create an account'}
      </h1>
      <p className="mt-2 text-stone-500">You need an account to submit stories.</p>
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
      <button
        onClick={() => {
          setFlow(flow === 'signIn' ? 'signUp' : 'signIn')
          setError(null)
        }}
        className="mt-4 text-sm text-stone-600 underline"
      >
        {flow === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
