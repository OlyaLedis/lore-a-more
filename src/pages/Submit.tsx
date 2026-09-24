import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'

export default function Submit() {
  const submit = useMutation(api.stories.submit)
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await submit({ title, body, author: author || undefined })
      navigate('/mine', { state: { submitted: true } })
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">Write a story</h1>
      <p className="text-stone-500">Olga reads every submission. Your story will appear in the feed once it's approved.</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Pen name <span className="font-normal text-stone-500">(optional)</span>
        </span>
        <input
          className={inputClass}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={60}
          placeholder="Anonymous"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Story</span>
        <textarea
          className={`${inputClass} min-h-80 font-serif leading-relaxed`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={50000}
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-stone-900 px-6 py-2 font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
