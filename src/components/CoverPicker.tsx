import { useMutation } from 'convex/react'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { AgeRange, StoredCategory } from '../../convex/taxonomy'
import { clamp, COVER_OFFSET, COVER_SCALE, coverFromScene, type CoverDraft } from '../covers'
import type { DraftScene } from '../scenes'
import { StoryCardBody, StoryCover, type CardStory } from './StoryCard'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'

// "Choose a cover": the colorful category cover, one of the story's pictures, or a separate upload,
// framed on white paper. Scale and position are display settings; the file itself is never changed.
export function CoverPicker({
  cover,
  onChange,
  scenes,
  preview,
  onUploadingChange,
}: {
  // Already resolved against the scenes (see effectiveCover).
  cover: CoverDraft
  onChange: (cover: CoverDraft) => void
  scenes: DraftScene[]
  // How the story's card will read, for the collection preview.
  preview: { title: string; category?: StoredCategory; ageRange?: AgeRange; place?: string }
  onUploadingChange: (uploading: boolean) => void
}) {
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl)
  const claimUpload = useMutation(api.covers.claimUpload)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The last uploaded cover stays available as an option after switching away from it.
  const [upload, setUpload] = useState<Extract<CoverDraft, { kind: 'image' }> | null>(
    cover.kind === 'image' && cover.source === 'upload' ? cover : null,
  )
  const pictures = scenes.flatMap((s) => s.illustrations).filter((i) => i.url)

  async function uploadCover(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Choose a picture file (JPEG, PNG, WebP, or GIF).')
    if (file.size > MAX_IMAGE_BYTES) return setError('Pictures must be 5 MB or smaller.')
    setUploading(true)
    onUploadingChange(true)
    try {
      const url = await generateUploadUrl()
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      // Claiming the file ties it to this author, so it can only be used on their stories.
      await claimUpload({ storageId })
      const next: CoverDraft = {
        kind: 'image',
        source: 'upload',
        storageId,
        url: URL.createObjectURL(file),
        alt: '',
        credit: '',
        scale: 1,
        x: 0,
        y: 0,
      }
      setUpload(next)
      onChange(next)
    } catch (err) {
      console.error(err)
      setError("The cover couldn't be uploaded. Check your connection and try again.")
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  const selected = (option: CoverDraft) =>
    option.kind === cover.kind && (option.kind === 'colors' || (cover.kind === 'image' && option.storageId === cover.storageId))

  const authorCard: CardStory = {
    _id: 'preview' as Id<'stories'>,
    title: preview.title || 'Your story',
    category: preview.category,
    ageRange: preview.ageRange,
    place: preview.place,
    cover: cover.kind === 'image' && cover.url ? { url: cover.url, scale: cover.scale, x: cover.x, y: cover.y } : null,
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Choose a cover</legend>
      <p className="mb-3 text-sm text-stone-500">
        The square on your story’s card. Pictures sit on a white paper frame and are never cropped; without one,
        the card uses your category’s colors.
      </p>

      <div role="radiogroup" aria-label="Cover" className="flex flex-wrap gap-3">
        <Option label="Colorful cover" checked={selected({ kind: 'colors' })} onSelect={() => onChange({ kind: 'colors' })}>
          <StoryCover category={preview.category} />
        </Option>
        {pictures.map((ill) => {
          const option = coverFromScene(ill)
          return (
            <Option
              key={ill.storageId}
              label={ill.alt ? `Story picture: ${ill.alt}` : 'Story picture'}
              checked={selected(option)}
              // Keep the framing if this picture is already the cover.
              onSelect={() => !selected(option) && onChange(option)}
            >
              <StoryCover cover={{ url: ill.url!, scale: 1, x: 0, y: 0 }} />
            </Option>
          )
        })}
        {upload?.url && (
          <Option label="Uploaded cover" checked={selected(upload)} onSelect={() => !selected(upload) && onChange(upload)}>
            <StoryCover cover={{ url: upload.url, scale: 1, x: 0, y: 0 }} />
          </Option>
        )}
        <div className="w-20">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void uploadCover(file)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 text-xs font-semibold text-stone-600 hover:border-stone-500 disabled:opacity-60"
          >
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-6 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-[auto_1fr] sm:p-5">
        <div className="mx-auto w-56 sm:w-60">
          {cover.kind === 'image' && cover.url ? (
            <FramingPreview cover={cover} onChange={onChange} />
          ) : (
            <StoryCover category={preview.category} />
          )}
        </div>
        <div className="space-y-4">
          {cover.kind === 'image' ? (
            <>
              <Slider
                label="Size"
                value={cover.scale}
                min={COVER_SCALE.min}
                max={COVER_SCALE.max}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(scale) => onChange({ ...cover, scale })}
              />
              <Slider
                label="Left / right"
                value={cover.x}
                min={-COVER_OFFSET}
                max={COVER_OFFSET}
                step={0.01}
                format={(v) => (Math.abs(v) < 0.005 ? 'Centered' : `${Math.round(v * 100)}`)}
                onChange={(x) => onChange({ ...cover, x })}
              />
              <Slider
                label="Up / down"
                value={cover.y}
                min={-COVER_OFFSET}
                max={COVER_OFFSET}
                step={0.01}
                format={(v) => (Math.abs(v) < 0.005 ? 'Centered' : `${Math.round(v * 100)}`)}
                onChange={(y) => onChange({ ...cover, y })}
              />
              <button
                type="button"
                onClick={() => onChange({ ...cover, scale: 1, x: 0, y: 0 })}
                className="text-sm font-medium text-stone-600 underline hover:text-stone-900"
              >
                Reset to fit
              </button>
              {cover.source === 'upload' ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Describe the cover</span>
                    <input
                      className={inputClass}
                      value={cover.alt}
                      maxLength={200}
                      required
                      placeholder="e.g. Three women weaving under a full moon"
                      onChange={(e) => onChange({ ...cover, alt: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">
                      Credit <span className="font-normal text-stone-500">(optional)</span>
                    </span>
                    <input
                      className={inputClass}
                      value={cover.credit}
                      maxLength={200}
                      placeholder="e.g. Drawn by Ana, age 9"
                      onChange={(e) => onChange({ ...cover, credit: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  The description and credit come from this picture’s scene.
                  {cover.credit && ` Credit: ${cover.credit}.`}
                </p>
              )}
              <p className="text-xs text-stone-500">Drag the picture, or use the arrow keys on it, to move it.</p>
            </>
          ) : (
            <p className="text-sm text-stone-600">
              The colorful cover uses your category’s colors. Choose a picture above or upload one to frame it instead.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">In the collection</p>
        <div aria-hidden className="grid grid-cols-3 gap-3 sm:max-w-xl sm:gap-4">
          <div className="opacity-70">
            <StoryCardBody story={exampleCards[0]} />
          </div>
          <div className="rounded-2xl outline-2 outline-offset-4 outline-orange-500">
            <StoryCardBody story={authorCard} />
          </div>
          <div className="opacity-70">
            <StoryCardBody story={exampleCards[1]} />
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">Your card is outlined; the others are examples.</p>
      </div>
    </fieldset>
  )
}

const exampleCards: CardStory[] = [
  { _id: 'example-a' as Id<'stories'>, title: 'The Bridge the Giant Built', category: 'legend', ageRange: '8+', place: 'Example place' },
  { _id: 'example-b' as Id<'stories'>, title: 'The Fox and the Lantern', category: 'wonder_tale', ageRange: '6+', place: 'Example place' },
]

function Option({
  label,
  checked,
  onSelect,
  children,
}: {
  label: string
  checked: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={`w-20 rounded-2xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-stone-900 ${
        checked ? 'outline-3 outline-orange-500' : 'opacity-90 hover:opacity-100'
      }`}
    >
      {children}
    </button>
  )
}

// The large cover preview. Drag (mouse or finger) or use arrow keys to move the picture; + and −
// change its size.
function FramingPreview({
  cover,
  onChange,
}: {
  cover: Extract<CoverDraft, { kind: 'image' }>
  onChange: (cover: CoverDraft) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const hintId = useId()

  const move = (x: number, y: number) =>
    onChange({ ...cover, x: clamp(x, -COVER_OFFSET, COVER_OFFSET), y: clamp(y, -COVER_OFFSET, COVER_OFFSET) })

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, x: cover.x, y: cover.y }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    const frame = frameRef.current
    if (!start || !frame) return
    // Offsets are fractions of the frame's inner area (82% of the square).
    const inner = frame.clientWidth * 0.82
    move(start.x + (e.clientX - start.startX) / inner, start.y + (e.clientY - start.startY) / inner)
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.02
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (moves[e.key]) {
      e.preventDefault()
      move(cover.x + moves[e.key][0], cover.y + moves[e.key][1])
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault()
      const scale = clamp(cover.scale + (e.key === '-' ? -0.05 : 0.05), COVER_SCALE.min, COVER_SCALE.max)
      onChange({ ...cover, scale })
    }
  }

  return (
    <div
      ref={frameRef}
      role="group"
      tabIndex={0}
      aria-label="Cover preview. Use the arrow keys to move the picture, plus and minus to resize."
      aria-describedby={hintId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={onKeyDown}
      className="cursor-grab touch-none rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 active:cursor-grabbing"
    >
      <StoryCover cover={{ url: cover.url!, scale: cover.scale, x: cover.x, y: cover.y }} className="shadow-sm" />
      <p id={hintId} className="sr-only">
        The picture is shown on a white paper frame and is never cropped in the saved file.
      </p>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-stone-500">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-orange-600"
      />
    </label>
  )
}
