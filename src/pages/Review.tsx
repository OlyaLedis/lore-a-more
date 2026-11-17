import { useMutation, usePaginatedQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { byline, formatDate } from '../format'
import { categoryLabel, SOURCE_KINDS, themeLabel } from '../../convex/taxonomy'
import { StoryCover, type CardCover } from '../components/StoryCard'
import { precisionNote } from '../location'

type Decision = 'approved' | 'rejected'

export default function Review() {
  const stories = usePaginatedQuery(api.stories.pending, {}, { initialNumItems: 10 })
  const edits = usePaginatedQuery(api.stories.pendingRevisions, {}, { initialNumItems: 10 })

  return (
    <div>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">Review submissions</h1>
      <p className="mt-2 text-stone-500">
        Approved stories and edits go live right away.{' '}
        <Link to="/admin/illustrators" className="underline underline-offset-4 hover:text-stone-900">
          Manage illustrators
        </Link>
      </p>

      <h2 className="mt-8 text-lg font-semibold">New stories</h2>
      <Queue query={stories} empty="No new stories waiting.">
        {stories.results.map((story) => (
          <PendingStory key={story._id} story={story} />
        ))}
      </Queue>

      <h2 className="mt-10 text-lg font-semibold">Edits to published stories</h2>
      <p className="mt-1 text-sm text-stone-500">
        Readers see the current version until you approve an edit. Rejecting keeps the current version.
      </p>
      <Queue query={edits} empty="No edits waiting.">
        {edits.results.map((revision) => (
          <PendingEdit key={revision._id} revision={revision} />
        ))}
      </Queue>
    </div>
  )
}

function Queue({
  query,
  empty,
  children,
}: {
  query: { status: string; results: unknown[]; loadMore: (n: number) => void }
  empty: string
  children: ReactNode
}) {
  if (query.status === 'LoadingFirstPage') return <p className="mt-4 text-stone-500">Loading…</p>
  if (query.results.length === 0) return <p className="mt-4 text-stone-500">{empty}</p>
  return (
    <>
      <ul className="mt-4 space-y-6">{children}</ul>
      {query.status === 'CanLoadMore' && (
        <button
          onClick={() => query.loadMore(10)}
          className="mt-6 w-full rounded-lg border border-stone-300 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Load more
        </button>
      )}
    </>
  )
}

type PendingStoryItem = FunctionReturnType<typeof api.stories.pending>['page'][number]
type PendingEditItem = FunctionReturnType<typeof api.stories.pendingRevisions>['page'][number]

function PendingStory({ story }: { story: PendingStoryItem }) {
  const review = useMutation(api.stories.review)
  return (
    <ReviewCard
      content={story}
      meta={`${byline(story.author)} · submitted ${formatDate(story._creationTime)}`}
      onDecide={(decision) => review({ id: story._id, decision })}
    />
  )
}

function PendingEdit({ revision }: { revision: PendingEditItem }) {
  const reviewRevision = useMutation(api.stories.reviewRevision)
  return (
    <ReviewCard
      content={revision}
      context={
        <p className="mb-2 text-sm text-stone-500">
          Edit to{' '}
          <Link to={`/story/${revision.storyId}`} className="font-medium underline">
            {revision.publishedTitle ?? 'a published story'}
          </Link>{' '}
          (opens the version readers see now)
        </p>
      }
      meta={`${byline(revision.author)} · edited ${formatDate(revision.submittedAt)}`}
      onDecide={(decision) => reviewRevision({ id: revision._id, decision })}
    />
  )
}

function ReviewCard({
  content,
  context,
  meta,
  onDecide,
}: {
  content: Pick<Doc<'stories'>, 'title' | 'body' | 'location' | 'category' | 'ageRange' | 'themes' | 'source'> & {
    scenes: { illustrations: { storageId: string; alt: string; credit?: string; url: string | null }[] }[]
    // The card cover the moderator is approving, as readers will see it.
    cardCover: CardCover | null
  }
  context?: ReactNode
  meta: string
  onDecide: (decision: Decision) => Promise<unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: Decision) {
    setBusy(true)
    setError(null)
    try {
      await onDecide(decision)
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-5">
      {context}
      <div className="flex items-start gap-4">
        <figure className="w-20 shrink-0">
          <StoryCover category={content.category} cover={content.cardCover} />
          <figcaption className="mt-1 text-center text-[11px] text-stone-500">Cover</figcaption>
        </figure>
        <h3 className="font-serif text-xl font-semibold">{content.title}</h3>
      </div>
      <p className="mt-1 text-sm text-stone-500">{meta}</p>
      {content.location && (
        <p className="mt-1 text-sm text-stone-500">
          Connected to {content.location.place ?? 'a pinned location'}
          {precisionNote(content.location.precision) && ` (${precisionNote(content.location.precision)})`}
        </p>
      )}
      <p className="mt-1 text-sm text-stone-500">
        {[
          content.category ? categoryLabel(content.category) : 'No category',
          content.ageRange ?? 'No age set',
          ...(content.themes ?? []).map(themeLabel),
        ].join(' · ')}
      </p>
      {content.source && (
        <p className="mt-1 text-sm text-stone-500">
          Source: {SOURCE_KINDS.find((k) => k.value === content.source!.kind)?.label}
          {content.source.detail && ` (${content.source.detail})`}
        </p>
      )}
      <div
        className={`mt-4 whitespace-pre-wrap font-serif leading-relaxed text-stone-800 ${expanded ? '' : 'line-clamp-6'}`}
      >
        {content.body}
      </div>
      {content.scenes.length > 1 && (
        <p className="mt-2 text-sm text-stone-500">{content.scenes.length} scenes</p>
      )}
      {content.scenes.some((s) => s.illustrations.length > 0) && (
        <ul aria-label="Pictures" className="mt-3 flex flex-wrap gap-3">
          {content.scenes.flatMap((scene, i) =>
            scene.illustrations.map((ill) => (
              <li key={ill.storageId} className="w-32">
                {ill.url && (
                  <a href={ill.url} target="_blank" rel="noreferrer">
                    <img src={ill.url} alt={ill.alt} className="h-32 w-32 rounded-lg object-cover" />
                  </a>
                )}
                <p className="mt-1 text-xs text-stone-600">
                  Scene {i + 1}: {ill.alt}
                  {ill.credit && <span className="block text-stone-400">Credit: {ill.credit}</span>}
                </p>
              </li>
            )),
          )}
        </ul>
      )}
      <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-stone-600 underline">
        {expanded ? 'Show less' : 'Read full story'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => decide('approved')}
          disabled={busy}
          className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide('rejected')}
          disabled={busy}
          className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </li>
  )
}
