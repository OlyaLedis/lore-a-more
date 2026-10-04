import { useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { Lightbox, type Picture } from '../components/Lightbox'
import { ReaderActions, SeasonalToggle } from '../components/ReaderActions'
import { StoryTags } from '../components/StoryCard'
import { RevisionBadge, StatusBadge } from '../components/StatusBadge'
import { StoryActions } from '../components/StoryActions'
import { BaseMap, StoryPin } from '../components/StoryMap'
import { byline, formatDate } from '../format'
import { precisionNote, zoomFor } from '../location'
import { useRecordView } from '../useRecordView'

export default function StoryPage() {
  const { id = '' } = useParams()
  const story = useQuery(api.stories.get, { id })
  // Non-null only for the story's author.
  const mine = useQuery(api.stories.editable, { id })
  const navigate = useNavigate()
  const [enlarged, setEnlarged] = useState<Picture | null>(null)
  useRecordView(story)

  if (story === undefined) return <p className="text-stone-500">Loading…</p>
  if (story === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">This story doesn't exist.</p>
        <Link to="/" className="mt-2 inline-block font-medium underline">
          Back to all stories
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/" className="text-sm text-stone-500 hover:text-stone-900">
        ← Home
      </Link>
      {mine && (
        <div className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={story.status} />
              <RevisionBadge status={mine.revisionStatus} />
            </div>
            <StoryActions id={story._id} onDeleted={() => navigate('/mine', { replace: true })} />
          </div>
          {mine.revisionStatus === 'pending' && (
            <p className="text-sm text-stone-600">
              Your changes are waiting for a moderator. Readers see the published version below until
              they're approved.
            </p>
          )}
          {mine.revisionStatus === 'rejected' && (
            <p className="text-sm text-stone-600">
              Your latest changes were not approved, so readers still see the version below. Edit the
              story to revise them and submit again.
            </p>
          )}
        </div>
      )}
      {!mine && story.status !== 'approved' && (
        <div className="mt-4">
          <StatusBadge status={story.status} />
        </div>
      )}
      <h1 className="mt-4 font-serif text-4xl font-bold leading-tight">{story.title}</h1>
      <p className="mt-2 text-stone-500">
        {byline(story.author)} · {formatDate(story.approvedAt ?? story._creationTime)}
        {story.editedAt && ` · edited ${formatDate(story.editedAt)}`}
        {story.location?.place && ` · ${story.location.place}`}
      </p>
      <div className="mt-4">
        <StoryTags story={story} />
      </div>
      <Link
        to={`/story/${story._id}/read`}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-lg font-semibold text-white hover:bg-stone-700"
      >
        <span aria-hidden>▶</span> Read together
      </Link>
      <p className="mt-1 text-sm text-stone-500">Large text with gentle scrolling, for reading aloud.</p>
      {story.status === 'approved' && (
        <div className="mt-5 flex flex-wrap items-start gap-2">
          <ReaderActions storyId={story._id} hasPlace={story.location !== undefined} />
          <SeasonalToggle storyId={story._id} />
        </div>
      )}
      {story.scenes.map((scene, i) => (
        <section key={scene.id} aria-label={story.scenes.length > 1 ? `Scene ${i + 1}` : undefined} className="mt-8">
          {i > 0 && (
            <div aria-hidden className="mb-8 text-center text-stone-400">
              ✦
            </div>
          )}
          {scene.text && (
            <div className="prose prose-stone prose-lg max-w-none whitespace-pre-wrap font-serif">{scene.text}</div>
          )}
          {scene.illustrations.map(
            (ill) =>
              ill.url && (
                <figure key={ill.storageId} className="mt-6">
                  <button
                    type="button"
                    onClick={() => setEnlarged({ url: ill.url!, alt: ill.alt, credit: ill.credit })}
                    aria-label={`View larger: ${ill.alt}`}
                    className="block w-full overflow-hidden rounded-2xl"
                  >
                    <img src={ill.url} alt={ill.alt} className="mx-auto max-h-[28rem] w-auto" />
                  </button>
                  {ill.credit && (
                    <figcaption className="mt-2 text-sm text-stone-500">Illustration: {ill.credit}</figcaption>
                  )}
                </figure>
              ),
          )}
        </section>
      ))}
      <Lightbox picture={enlarged} onClose={() => setEnlarged(null)} />
      <SourceNote source={story.source} />
      {story.location && (
        <div className="mt-10">
          <BaseMap center={story.location} zoom={zoomFor(story.location.precision)} className="h-64">
            <StoryPin center={story.location} precision={story.location.precision} />
          </BaseMap>
          {precisionNote(story.location.precision) && (
            <p className="mt-2 text-sm text-stone-500">{precisionNote(story.location.precision)}</p>
          )}
        </div>
      )}
    </article>
  )
}

// Says where the story comes from, without presenting a retelling as verified history.
function SourceNote({ source }: { source: Doc<'stories'>['source'] }) {
  if (!source) return null
  let text
  if (source.kind === 'personal') {
    text = 'A personal story, shared by the person who lived it or their family.'
  } else if (source.kind === 'retelling') {
    text = `A creative retelling of a traditional story, not a historical account.${
      source.detail ? ` Heard or read from: ${source.detail}.` : ''
    }`
  } else {
    text = `Based on: ${source.detail}. This is the author's version, not a quotation of the source.`
  }
  return <p className="mt-8 border-l-2 border-stone-300 pl-4 text-sm text-stone-600">{text}</p>
}
