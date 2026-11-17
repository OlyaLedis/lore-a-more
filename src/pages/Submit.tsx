import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import {
  AGE_RANGES,
  CATEGORIES,
  isCurrentCategory,
  isCurrentTheme,
  MAX_THEMES,
  SOURCE_KINDS,
  THEMES,
  type AgeRange,
  type StoryCategory,
  type StorySource,
  type StoryTheme,
} from '../../convex/taxonomy'
import { CoverPicker } from '../components/CoverPicker'
import { BackLink } from '../components/BackLink'
import { useBackLink } from '../backLink'
import { storyPath } from '../storyLinks'
import { LocationField } from '../components/LocationField'
import { ReadingView } from '../components/ReadingView'
import { SceneEditor } from '../components/SceneEditor'
import { coverForSubmit, coverProblem, effectiveCover, initialCover, type CoverDraft } from '../covers'
import { draftFromParams, draftFromSaved, locationProblem, toSubmitLocation, type LocationDraft } from '../location'
import { draftsFromScenes, emptyScene, scenesForSubmit, scenesProblem, type DraftScene } from '../scenes'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'

type StoryValues = {
  title: string
  author?: string
  scenes: ReturnType<typeof scenesForSubmit>
  cover: ReturnType<typeof coverForSubmit>
  location?: ReturnType<typeof toSubmitLocation>
  category: StoryCategory
  ageRange: AgeRange
  themes: StoryTheme[]
  source: StorySource
}

type Initial = {
  title: string
  author: string
  scenes: DraftScene[]
  cover: CoverDraft
  location: LocationDraft | null
  category?: StoryCategory
  ageRange?: AgeRange
  themes: StoryTheme[]
  source?: StorySource
}

// New story.
export default function Submit() {
  const submit = useMutation(api.stories.submit)
  const navigate = useNavigate()
  // A place chosen on the map ("Add a story" in the map search) starts the form with that location.
  const [params] = useSearchParams()
  const [startPlace] = useState(() => draftFromParams(params))
  const back = useBackLink({ to: '/', label: 'Home' })
  return (
    <StoryForm
      heading="Add a Story"
      // Back to where the form was opened from, by name ("← Map"; the map reopens where it was left).
      // With no page before it in this tab (a link opened directly), there's nothing to go back to.
      back={back}
      initial={
        startPlace
          ? { title: '', author: '', scenes: [emptyScene()], cover: { kind: 'colors' }, location: startPlace, themes: [] }
          : undefined
      }
      intro="A moderator reads every submission. Your story will appear on Loramore once it's approved."
      submitLabel="Submit for review"
      onSave={async (values) => {
        await submit(values)
        navigate('/mine', { state: { submitted: true } })
      }}
    />
  )
}

// Edit an existing story: the same form, filled with the author's latest version.
export function EditStory() {
  const { id = '' } = useParams()
  const story = useQuery(api.stories.editable, { id })
  const update = useMutation(api.stories.update)
  const navigate = useNavigate()
  // Back where the form was opened from (usually the story or My stories); opened directly, to the story.
  const back = useBackLink(story ? { to: storyPath(story), label: story.title } : { to: '/mine', label: 'My stories' })

  if (story === undefined) return <p className="text-stone-500">Loading…</p>
  if (story === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">This story doesn't exist, or it isn't yours to edit.</p>
        <Link to="/mine" className="mt-2 inline-block font-medium underline">
          Back to my stories
        </Link>
      </div>
    )
  }

  const published = story.status === 'approved'
  // Stories written before categories existed have none; the author picks them, we never guess.
  // A retired category (Local Legends…) counts as missing: the author chooses one of the new ones.
  const retiredCategory = Boolean(story.category) && !isCurrentCategory(story.category)
  const missingDetails = !isCurrentCategory(story.category) || !story.ageRange || !story.source
  // Retired themes aren't offered any more, so the author picks current ones instead.
  const themes = (story.themes ?? []).filter(isCurrentTheme)
  const retiredThemes = themes.length < (story.themes ?? []).length
  return (
    <StoryForm
      // Remount if the story changes underneath, so the form never mixes two versions.
      key={story._id}
      heading="Edit Story"
      intro={
        published
          ? 'Your changes go to a moderator first. Readers keep seeing the published version until they are approved.'
          : 'Your changes go to a moderator before the story appears on Loramore.'
      }
      notice={
        story.revisionStatus === 'pending'
          ? 'You already have changes waiting for review. Submitting again replaces them.'
          : story.revisionStatus === 'rejected'
            ? 'Your last changes were not approved. You can revise them and submit again.'
            : missingDetails
              ? retiredCategory
                ? 'The story types have changed. Please choose whether this is a True Tale, a Legend, or a Wonder Tale below.'
                : 'This story was written before categories, ages, and sources were added. Please choose them below.'
              : retiredThemes
                ? 'The list of themes has changed. Please choose your story’s themes again below.'
                : undefined
      }
      submitLabel="Submit changes for review"
      initial={{
        title: story.title,
        author: story.author ?? '',
        // Stories from before scenes arrive as one scene; the author can divide it.
        scenes: draftsFromScenes(story.scenes),
        // Starts as whatever the story's card shows now.
        cover: initialCover(story.cover, draftsFromScenes(story.scenes)),
        location: story.location ? draftFromSaved(story.location) : null,
        category: isCurrentCategory(story.category) ? story.category : undefined,
        ageRange: story.ageRange,
        themes,
        source: story.source,
      }}
      back={back}
      onCancel={() => back?.go()}
      onSave={async (values) => {
        await update({ id: story._id, ...values })
        navigate('/mine', { state: { submitted: true, edited: true } })
      }}
    />
  )
}

function StoryForm({
  heading,
  back,
  intro,
  notice,
  submitLabel,
  initial,
  onSave,
  onCancel,
}: {
  heading: string
  intro: string
  notice?: string
  submitLabel: string
  initial?: Initial
  onSave: (values: StoryValues) => Promise<void>
  onCancel?: () => void
  back?: { label: string; go: () => void } | null
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [scenes, setScenes] = useState<DraftScene[]>(() => initial?.scenes ?? [emptyScene()])
  const [coverDraft, setCoverDraft] = useState<CoverDraft>(initial?.cover ?? { kind: 'colors' })
  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [category, setCategory] = useState<StoryCategory | undefined>(initial?.category)
  const [ageRange, setAgeRange] = useState<AgeRange | undefined>(initial?.ageRange)
  const [themes, setThemes] = useState<StoryTheme[]>(initial?.themes ?? [])
  const [source, setSource] = useState<StorySource | undefined>(initial?.source)
  const [location, setLocation] = useState<LocationDraft | null>(initial?.location ?? null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The cover as it will be saved: a removed scene picture falls back to the colorful cover.
  const shownCover = effectiveCover(coverDraft, scenes)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // The browser checks required radios and the source field; these are a fallback.
    if (!category || !ageRange || !source) {
      setError('Choose a category, an age, and where the story comes from.')
      return
    }
    const cover = effectiveCover(coverDraft, scenes)
    const problem = scenesProblem(scenes) ?? coverProblem(cover) ?? locationProblem(location)
    if (problem) {
      setError(problem)
      return
    }
    setSubmitting(true)
    try {
      await onSave({
        title,
        scenes: scenesForSubmit(scenes),
        cover: coverForSubmit(cover),
        author: author || undefined,
        location: toSubmitLocation(location),
        category,
        ageRange,
        themes,
        source: {
          kind: source.kind,
          detail: source.detail?.trim() || undefined,
          url: source.kind === 'personal' ? undefined : source.url?.trim() || undefined,
        },
      })
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div>
        <BackLink back={back ?? null} className="mb-3" />
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">{heading}</h1>
        <p className="mt-2 text-stone-500">{intro}</p>
      </div>
      {notice && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{notice}</p>}
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
      <SceneEditor scenes={scenes} onChange={setScenes} onUploadingChange={setUploading} />
      <button
        type="button"
        onClick={() => setPreviewing(true)}
        disabled={!scenes.some((sc) => sc.text.trim() || sc.illustrations.length > 0)}
        className="rounded-full border border-stone-900 px-5 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-40"
      >
        Preview reading mode
      </button>
      {previewing && (
        <ReadingView
          title={title.trim() || 'Untitled story'}
          author={author.trim() || undefined}
          scenes={scenes}
          onClose={() => setPreviewing(false)}
          closeLabel="Back to editing"
        />
      )}

      <ChoiceGroup legend="Could this really have happened?" hint="Tales full of magic are just as welcome as true ones.">
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <OptionCard
              key={c.value}
              name="category"
              checked={category === c.value}
              onChange={() => setCategory(c.value)}
              label={c.one}
              hint={c.hint}
              required
            />
          ))}
        </div>
      </ChoiceGroup>

      <ChoiceGroup legend="Age" hint="The youngest age this story suits. It's shown on the story's card.">
        <div className="flex gap-2">
          {AGE_RANGES.map((age) => (
            <label
              key={age}
              className={`cursor-pointer rounded-full border px-5 py-2 font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 ${
                ageRange === age ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:border-stone-500'
              }`}
            >
              <input
                type="radio"
                name="ageRange"
                value={age}
                checked={ageRange === age}
                onChange={() => setAgeRange(age)}
                required
                className="sr-only"
              />
              {age}
            </label>
          ))}
        </div>
      </ChoiceGroup>

      <ChoiceGroup legend="Themes" optional hint={`Choose up to ${MAX_THEMES}. They help readers find your story.`}>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => {
            const checked = themes.includes(t.value)
            const disabled = !checked && themes.length >= MAX_THEMES
            return (
              <label
                key={t.value}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 ${
                  checked
                    ? 'cursor-pointer border-orange-600 bg-orange-50 text-orange-800'
                    : disabled
                      ? 'cursor-not-allowed border-stone-200 text-stone-400'
                      : 'cursor-pointer border-stone-300 bg-white hover:border-stone-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    setThemes(checked ? themes.filter((x) => x !== t.value) : [...themes, t.value])
                  }
                  className="sr-only"
                />
                {t.label}
              </label>
            )
          })}
        </div>
      </ChoiceGroup>

      <LocationField value={location} onChange={setLocation} />

      {coverDraft.kind === 'image' && shownCover.kind === 'colors' && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The picture you chose as the cover was removed from the story, so the colorful cover will be used.
        </p>
      )}
      <CoverPicker
        cover={shownCover}
        onChange={setCoverDraft}
        scenes={scenes}
        preview={{ title: title.trim(), category, ageRange, place: location?.place.trim() || undefined }}
        onUploadingChange={setUploading}
      />

      <ChoiceGroup
        legend="Where does this story come from?"
        hint="Retellings are shown as creative versions, not as verified history."
      >
        <div className="space-y-2">
          {SOURCE_KINDS.map((k) => (
            <OptionCard
              key={k.value}
              name="sourceKind"
              checked={source?.kind === k.value}
              onChange={() => setSource({ kind: k.value, detail: source?.detail, url: source?.url })}
              label={k.label}
              hint={k.hint}
              required
            />
          ))}
        </div>
        {source && source.kind !== 'personal' && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium">
              {source.kind === 'reference' ? 'Source' : 'Where you heard or read it'}{' '}
              {source.kind === 'retelling' && <span className="font-normal text-stone-500">(optional)</span>}
            </span>
            <input
              className={inputClass}
              value={source.detail ?? ''}
              onChange={(e) => setSource({ ...source, detail: e.target.value })}
              maxLength={300}
              required={source.kind === 'reference'}
              placeholder={
                source.kind === 'reference'
                  ? 'e.g. “Legends of the Coast”, M. Silva, 1998'
                  : 'e.g. my grandmother, a village festival'
              }
            />
          </label>
        )}
        {source && source.kind !== 'personal' && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium">
              Link to the source <span className="font-normal text-stone-500">(optional)</span>
            </span>
            <input
              type="url"
              className={inputClass}
              value={source.url ?? ''}
              onChange={(e) => setSource({ ...source, url: e.target.value })}
              maxLength={500}
              placeholder="https://…"
            />
          </label>
        )}
      </ChoiceGroup>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-full bg-stone-900 px-6 py-2 font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : uploading ? 'Uploading picture…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-stone-600 hover:text-stone-900">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function ChoiceGroup({
  legend,
  hint,
  optional = false,
  children,
}: {
  legend: string
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  const hintId = useId()
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-1 text-sm font-medium">
        {legend} {optional && <span className="font-normal text-stone-500">(optional)</span>}
      </legend>
      {hint && (
        <p id={hintId} className="mb-2 text-sm text-stone-500">
          {hint}
        </p>
      )}
      {children}
    </fieldset>
  )
}

function OptionCard({
  name,
  checked,
  onChange,
  label,
  hint,
  required,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
  hint: string
  required?: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 ${
        checked ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white hover:border-stone-400'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        required={required}
        className="mt-1 accent-stone-900"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-stone-500">{hint}</span>
      </span>
    </label>
  )
}
