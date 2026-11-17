import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { CharacterCards } from '../components/CharacterCard'
import { IllustratorCredit } from '../components/IllustratorCredit'
import { IllustratorPicker } from '../components/IllustratorPicker'
import { Illustration } from '../components/Illustration'
import { Lightbox, type Picture } from '../components/Lightbox'
import { ReaderActions, SeasonalToggle } from '../components/ReaderActions'
import { StoryTags } from '../components/StoryCard'
import { TypePhrase } from '../components/StoryType'
import { ArrowLeftIcon } from '../components/Icons'
import { useBackLink } from '../backLink'
import { PlaceTrail } from '../components/PlaceTrail'
import { RevisionBadge, StatusBadge } from '../components/StatusBadge'
import { StoryActions } from '../components/StoryActions'
import { BaseMap, StoryPin } from '../components/StoryMap'
import { categoryLabel, isCurrentCategory } from '../../convex/taxonomy'
import { byline, formatDate } from '../format'
import { googleMapsUrl, precisionNote, zoomFor } from '../location'
import { usePlaceStatus } from '../mapStatus'
import { dotColor, mapCategory } from '../mapStories'
import { useRecordView } from '../useRecordView'
import { readPath, storyKey, storyPath } from '../storyLinks'
import { joinPictureOnlyScenes, layoutScene } from '../sceneLayout'

export default function StoryPage() {
  const { id = '' } = useParams()
  const story = useQuery(api.stories.get, { id })
  // Non-null only for the story's author.
  const mine = useQuery(api.stories.editable, { id })
  const me = useQuery(api.users.me)
  const navigate = useNavigate()
  const [enlarged, setEnlarged] = useState<Picture | null>(null)
  const back = useBackLink()
  useRecordView(story)
  // The story's place in the strip above the header.
  usePlaceStatus(story?.location ? { ...story.location, label: story.location.place?.split(',')[0] } : null)
  useCanonicalPath(story)

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
      {/* Back where the reader came from, by name ("← Map"); none when the story was opened directly. */}
      {back && (
        <button type="button" onClick={back.go} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeftIcon className="h-4 w-4" />
          {back.label}
        </button>
      )}
      {mine && (
        <div className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={story.status} />
              <RevisionBadge status={mine.revisionStatus} />
            </div>
            <StoryActions id={story._id} code={story.code} onDeleted={() => navigate('/mine', { replace: true })} />
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
      {/* The story type as on the map's story sheet ("A wonder tale"), linking to more of that type. A
          retired type shows its old name, plainly. */}
      {story.category && (
        <p className="mt-4">
          {isCurrentCategory(story.category) ? (
            <Link to={`/search?category=${story.category}`} className="underline-offset-4 hover:underline">
              <TypePhrase category={mapCategory(story.category)} className="text-lg" />
            </Link>
          ) : (
            <span className="font-serif text-lg italic text-stone-500">{categoryLabel(story.category)}</span>
          )}
        </p>
      )}
      <h1 className={`${story.category ? 'mt-0.5' : 'mt-4'} font-serif text-4xl font-bold leading-tight`}>{story.title}</h1>
      {story.location?.place && (
        <p className="mt-2 text-stone-500">
          {/* Published stories are on the Map tab: each part of the place shows it there. */}
          {story.status === 'approved' ? (
            <PlaceTrail
              place={story.location.place}
              at={story.location}
              precision={story.location.precision}
              linkTo={(part) => `/map?${new URLSearchParams({ story: storyKey(story), part: String(part) })}`}
            />
          ) : (
            story.location.place
          )}
        </p>
      )}
      <IllustratorCredit storyId={story._id} className="mt-1 text-stone-500" />
      <div className="mt-4">
        <StoryTags story={story} />
      </div>
      {me?.isAdmin && <IllustratorPicker storyId={story._id} />}
      <Link
        to={readPath(story)}
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
      {joinPictureOnlyScenes(story.scenes).map((scene, i, scenes) => {
        const figures = scene.illustrations.map(
          (ill) =>
            ill.url && (
              <figure key={ill.storageId} className="mt-6">
                <Illustration
                  picture={{ url: ill.url, alt: ill.alt, credit: ill.credit }}
                  maxHeight="28rem"
                  onOpen={() => setEnlarged({ url: ill.url!, alt: ill.alt, credit: ill.credit })}
                />
                {ill.credit && (
                  <figcaption className="mt-2 text-sm text-stone-500">Illustration: {ill.credit}</figcaption>
                )}
              </figure>
            ),
        )
        // The story begins with text; its first picture follows the first paragraph and the others are
        // spread through the text, never two in a row (src/sceneLayout.ts).
        return (
          <section key={scene.id} aria-label={scenes.length > 1 ? `Scene ${i + 1}` : undefined} className="mt-8">
            {/* ✦ between scenes only where text meets text: a scene with pictures ends with one, which
                already divides it from the next. */}
            {i > 0 && scenes[i - 1].illustrations.length === 0 && (
              <div aria-hidden className="mb-8 text-center text-stone-400">
                ✦
              </div>
            )}
            {layoutScene(scene.text, figures.length, i === 0).map((block, b) =>
              block.kind === 'picture' ? (
                figures[block.index]
              ) : (
                <div
                  key={`t${block.index}`}
                  className={`prose prose-stone prose-lg max-w-none whitespace-pre-wrap font-serif ${b > 0 ? 'mt-6' : ''}`}
                >
                  {block.text}
                </div>
              ),
            )}
          </section>
        )
      })}
      <Lightbox picture={enlarged} onClose={() => setEnlarged(null)} />
      <CharacterCards storyId={story._id} />
      {/* Below the text: the writer's pen name (none for the curated legends, whose source note says where
          they come from) and the date. */}
      <p className="mt-8 text-sm text-stone-500">
        {!story.importId && `By ${byline(story.author)} · `}
        {formatDate(story.approvedAt ?? story._creationTime)}
        {story.editedAt && ` · edited ${formatDate(story.editedAt)}`}
      </p>
      <SourceNote source={story.source} />
      {story.location && (
        <div className="mt-10">
          <BaseMap center={story.location} zoom={zoomFor(story.location.precision)} className="h-64">
            <StoryPin center={story.location} color={dotColor(mapCategory(story.category))} large title={story.title} />
          </BaseMap>
          <p className="mt-2 text-sm text-stone-500">
            {precisionNote(story.location.precision) && `${precisionNote(story.location.precision)} · `}
            <a
              href={googleMapsUrl(story.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-700 underline-offset-2 hover:underline"
            >
              Open in Google Maps ↗
            </a>
          </p>
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
  return (
    <p className="mt-8 border-l-2 border-stone-300 pl-4 text-sm text-stone-600">
      {text}
      {source.kind !== 'personal' && source.url && (
        <>
          {' '}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-orange-700 underline-offset-2 hover:underline"
          >
            Read the source ↗
          </a>
        </>
      )}
    </p>
  )
}

// Shows the story's current address (/story/<code>/<title>) in the browser, so an older link (by
// database id, or with a title that has since changed) still opens it but is shared in its current form.
function useCanonicalPath(story: { _id: string; code?: string; title: string } | null | undefined) {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const canonical = story ? storyPath(story) : null
  useEffect(() => {
    if (canonical && decodeURIComponent(pathname) !== canonical) navigate(canonical + search + hash, { replace: true })
  }, [canonical, pathname, search, hash, navigate])
}
