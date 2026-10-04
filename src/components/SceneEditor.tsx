import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { emptyScene, type DraftScene } from '../scenes'

const MAX_SCENES = 50
const MAX_PICTURES = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'
const smallButton =
  'rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-medium hover:border-stone-500 disabled:opacity-40'

// Ordered scene blocks: text plus optional pictures, which appear after the scene's text.
export function SceneEditor({
  scenes,
  onChange,
  onUploadingChange,
}: {
  scenes: DraftScene[]
  onChange: (scenes: DraftScene[]) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const update = (index: number, scene: DraftScene) => onChange(scenes.map((s, i) => (i === index ? scene : s)))

  const move = (index: number, by: -1 | 1) => {
    const next = [...scenes]
    const [scene] = next.splice(index, 1)
    next.splice(index + by, 0, scene)
    onChange(next)
  }

  // Splitting keeps the order of everything: text before the cursor stays, the rest and the
  // scene's pictures move to a new scene right after it.
  const split = (index: number, at: number) => {
    const scene = scenes[index]
    const before = { ...scene, text: scene.text.slice(0, at).trimEnd(), illustrations: [] }
    const after = { ...emptyScene(scenes), text: scene.text.slice(at).trimStart(), illustrations: scene.illustrations }
    onChange([...scenes.slice(0, index), before, after, ...scenes.slice(index + 1)])
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Story</legend>
      <p className="mb-3 text-sm text-stone-500">
        Write in one scene, or divide the story into scenes. Pictures appear after their scene's text. In reading
        mode, scrolling stops at each picture so readers can look before going on.
      </p>
      <ol className="space-y-4">
        {scenes.map((scene, index) => (
          <SceneBlock
            key={scene.id}
            scene={scene}
            index={index}
            count={scenes.length}
            onChange={(s) => update(index, s)}
            onMove={(by) => move(index, by)}
            onSplit={(at) => split(index, at)}
            onRemove={() => onChange(scenes.filter((_, i) => i !== index))}
            onUploadingChange={onUploadingChange}
          />
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...scenes, emptyScene(scenes)])}
        disabled={scenes.length >= MAX_SCENES}
        className="mt-3 w-full rounded-xl border-2 border-dashed border-stone-300 py-3 text-sm font-semibold text-stone-600 hover:border-stone-500 hover:text-stone-900 disabled:opacity-40"
      >
        + Add a scene
      </button>
    </fieldset>
  )
}

function SceneBlock({
  scene,
  index,
  count,
  onChange,
  onMove,
  onSplit,
  onRemove,
  onUploadingChange,
}: {
  scene: DraftScene
  index: number
  count: number
  onChange: (scene: DraftScene) => void
  onMove: (by: -1 | 1) => void
  onSplit: (at: number) => void
  onRemove: () => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = index + 1
  const hasContent = scene.text.trim() !== '' || scene.illustrations.length > 0
  const canSplit = cursor !== null && cursor > 0 && cursor < scene.text.length

  async function addPicture(file: File) {
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
      onChange({
        ...scene,
        illustrations: [...scene.illustrations, { storageId, alt: '', credit: '', url: URL.createObjectURL(file) }],
      })
    } catch (err) {
      console.error(err)
      setError("The picture couldn't be uploaded. Check your connection and try again.")
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Scene {n}</h3>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={smallButton} aria-label={`Move scene ${n} up`}>
            ↑ Up
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className={smallButton}
            aria-label={`Move scene ${n} down`}
          >
            ↓ Down
          </button>
          <button
            type="button"
            onClick={() => cursor !== null && onSplit(cursor)}
            disabled={!canSplit}
            title="Put the cursor where the new scene should start"
            className={smallButton}
          >
            Split at cursor
          </button>
          {count > 1 && (
            <button
              type="button"
              onClick={() => (hasContent ? setConfirmingRemove(true) : onRemove())}
              className={`${smallButton} text-red-700`}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {confirmingRemove && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
          Remove scene {n} and its pictures?
          <button type="button" onClick={onRemove} className="font-semibold underline">
            Remove
          </button>
          <button type="button" onClick={() => setConfirmingRemove(false)} className="underline">
            Cancel
          </button>
        </div>
      )}

      <label className="block">
        <span className="sr-only">Scene {n} text</span>
        <textarea
          ref={textRef}
          className={`${inputClass} min-h-40 font-serif leading-relaxed`}
          value={scene.text}
          onChange={(e) => onChange({ ...scene, text: e.target.value })}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
          onBlur={(e) => setCursor(e.currentTarget.selectionStart)}
          maxLength={50000}
          placeholder={index === 0 ? 'Once upon a time…' : 'What happens next…'}
        />
      </label>

      {scene.illustrations.length > 0 && (
        <ul className="mt-3 space-y-3">
          {scene.illustrations.map((ill, i) => (
            <li key={ill.storageId} className="flex flex-col gap-3 rounded-xl bg-stone-50 p-3 sm:flex-row">
              {ill.url ? (
                <img src={ill.url} alt="" className="h-28 w-28 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-stone-200 text-xs text-stone-500">
                  Missing
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Describe the picture</span>
                  <input
                    className={inputClass}
                    value={ill.alt}
                    maxLength={200}
                    required
                    placeholder="e.g. A giant lifting an iron net out of the river"
                    onChange={(e) =>
                      onChange({
                        ...scene,
                        illustrations: scene.illustrations.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    Credit <span className="font-normal text-stone-500">(optional)</span>
                  </span>
                  <input
                    className={inputClass}
                    value={ill.credit}
                    maxLength={200}
                    placeholder="e.g. Drawn by Ana, age 9"
                    onChange={(e) =>
                      onChange({
                        ...scene,
                        illustrations: scene.illustrations.map((x, j) => (j === i ? { ...x, credit: e.target.value } : x)),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onChange({ ...scene, illustrations: scene.illustrations.filter((_, j) => j !== i) })}
                  className="text-sm font-medium text-red-700 underline"
                >
                  Remove picture
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void addPicture(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || scene.illustrations.length >= MAX_PICTURES}
          className={smallButton}
        >
          {uploading ? 'Uploading…' : '+ Add a picture'}
        </button>
        {scene.illustrations.length >= MAX_PICTURES && (
          <span className="text-xs text-stone-500">Up to {MAX_PICTURES} pictures per scene.</span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  )
}
