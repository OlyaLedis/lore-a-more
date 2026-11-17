import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { StoryCard } from '../components/StoryCard'
import { illustratorPath } from '../illustrators'

const errorText = (err: unknown) => (err instanceof ConvexError ? String(err.data) : 'That didn’t save. Try again.')
const input = 'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none'
const label = 'block text-sm font-medium text-stone-700'
const primary = 'rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60'

// /admin/illustrators — every illustrator, and a field to add one. Adding a name that already has a
// profile is refused, so each artist has one page.
export function AdminIllustrators() {
  const all = useQuery(api.illustrators.list, {})
  const create = useMutation(api.illustrators.create)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = await create({ name, links: [] })
      navigate(`/admin/illustrators/${id}`)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Illustrators"
        subtitle="Profiles and credits for the artists who draw the stories. Assign illustrators on each story's page."
      />
      <form onSubmit={(e) => void add(e)} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="new-illustrator" className={label}>
            Add an illustrator
          </label>
          <input
            id="new-illustrator"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
            className={input}
            required
          />
        </div>
        <button type="submit" disabled={busy || !name.trim()} className={primary}>
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {all === undefined ? (
        <p className="mt-8 text-stone-500">Loading…</p>
      ) : all.length === 0 ? (
        <p className="mt-8 text-stone-500">No illustrators yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {all.map((i) => (
            <li key={i._id} className="flex items-center gap-4 px-4 py-3">
              <Avatar url={i.photoUrl} name={i.name} />
              <div className="min-w-0 flex-1">
                <Link to={`/admin/illustrators/${i._id}`} className="font-medium text-stone-900 hover:underline">
                  {i.name}
                </Link>
                <p className="text-sm text-stone-500">
                  {i.storyCount > 100 ? '100+' : i.storyCount} {i.storyCount === 1 ? 'story' : 'stories'}
                </p>
              </div>
              <Link to={illustratorPath(i)} className="text-sm text-stone-500 underline-offset-4 hover:underline">
                View profile
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Avatar({ url, name, large = false }: { url: string | null; name: string; large?: boolean }) {
  const size = large ? 'h-24 w-24 text-2xl' : 'h-10 w-10 text-sm'
  return url ? (
    <img src={url} alt="" className={`${size} shrink-0 rounded-full bg-paper object-cover ring-1 ring-stone-900/10`} />
  ) : (
    <span aria-hidden className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-stone-200 font-semibold text-stone-600`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

// /admin/illustrators/:id — edit a profile: name, picture, biography, website and other links, and the
// stories assigned to it.
export function AdminIllustrator() {
  const { id = '' } = useParams()
  const illustrator = useQuery(api.illustrators.forEditing, { id: id as Id<'illustrators'> })
  if (illustrator === undefined) return <p className="text-stone-500">Loading…</p>
  if (illustrator === null) return <p className="text-stone-500">That illustrator doesn't exist.</p>
  // Remounts the form when another profile opens, so it starts from that profile's saved values.
  return <EditIllustrator key={illustrator._id} illustrator={illustrator} />
}

type Editing = NonNullable<FunctionReturnType<typeof api.illustrators.forEditing>>

function EditIllustrator({ illustrator }: { illustrator: Editing }) {
  const update = useMutation(api.illustrators.update)
  const [name, setName] = useState(illustrator.name)
  const [bio, setBio] = useState(illustrator.bio)
  const [basedIn, setBasedIn] = useState(illustrator.basedIn)
  const [website, setWebsite] = useState(illustrator.website)
  const [links, setLinks] = useState(illustrator.links.join('\n'))
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await update({ id: illustrator._id, name, bio, basedIn, website, links: links.split('\n').map((l) => l.trim()).filter(Boolean) })
      setStatus({ kind: 'saved', text: 'Saved.' })
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin/illustrators" className="text-sm text-stone-500 hover:text-stone-900">
        ← Illustrators
      </Link>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-700 sm:text-3xl">{illustrator.name}</h1>
        <Link to={illustratorPath(illustrator)} className="shrink-0 text-sm text-stone-500 underline-offset-4 hover:underline">
          View profile
        </Link>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Profile address: <span className="break-all">{window.location.origin + illustratorPath(illustrator)}</span>. It stays
        the same if the name changes.
      </p>

      <div className="mt-6 space-y-5">
        <PictureField illustrator={illustrator} kind="photo" />
        <PictureField illustrator={illustrator} kind="cover" />
      </div>

      <form onSubmit={(e) => void save(e)} className="mt-8 space-y-5">
        <div>
          <label htmlFor="ill-name" className={label}>
            Name
          </label>
          <input id="ill-name" value={name} onChange={(e) => setName(e.target.value)} className={input} required />
        </div>
        <div>
          <label htmlFor="ill-bio" className={label}>
            Biography <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <textarea id="ill-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className={input} />
        </div>
        <div>
          <label htmlFor="ill-based-in" className={label}>
            Based in <span className="font-normal text-stone-500">(optional: where they live, not where their stories are set)</span>
          </label>
          <input id="ill-based-in" value={basedIn} onChange={(e) => setBasedIn(e.target.value)} placeholder="Helsinki, Finland" className={input} />
        </div>
        <div>
          <label htmlFor="ill-website" className={label}>
            Portfolio website <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input id="ill-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="olga-draws.com" className={input} />
        </div>
        <div>
          <label htmlFor="ill-links" className={label}>
            Other links <span className="font-normal text-stone-500">(optional, one per line: Instagram, Behance, LinkedIn…)</span>
          </label>
          <textarea
            id="ill-links"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={3}
            placeholder={'instagram.com/olga\nbehance.net/olga'}
            className={`${input} font-mono text-sm`}
          />
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" disabled={busy} className={primary}>
            Save
          </button>
          {status && <p className={`text-sm ${status.kind === 'error' ? 'text-red-700' : 'text-stone-500'}`}>{status.text}</p>}
        </div>
      </form>

      <section aria-labelledby="ill-stories" className="mt-12">
        <h2 id="ill-stories" className="text-xl font-semibold text-stone-700">
          Stories
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Assign this illustrator on a story's page. Only published stories show in the public gallery.
        </p>
        {illustrator.stories.length === 0 ? (
          <p className="mt-4 text-stone-500">No stories assigned yet.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {illustrator.stories.map((story) => (
              <div key={story._id}>
                <StoryCard story={story} wide />
                {story.status !== 'approved' && (
                  <div className="mt-1">
                    <StatusBadge status={story.status} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function PictureField({ illustrator, kind }: { illustrator: Editing; kind: 'photo' | 'cover' }) {
  const uploadUrl = useMutation(api.illustrators.photoUploadUrl)
  const setPicture = useMutation(api.illustrators.setPicture)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const url = kind === 'photo' ? illustrator.photoUrl : illustrator.coverUrl
  const what = kind === 'photo' ? 'portrait' : 'cover picture'

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Choose a picture (JPEG, PNG, or WebP).')
    if (file.size > MAX_PHOTO_BYTES) return setError('Pictures must be 5 MB or smaller.')
    setBusy(true)
    try {
      const response = await fetch(await uploadUrl(), { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      if (!response.ok) throw new Error('upload failed')
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
      await setPicture({ id: illustrator._id, kind, storageId })
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : 'The picture didn’t upload. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-5">
      {kind === 'photo' ? (
        <Avatar url={url} name={illustrator.name} large />
      ) : url ? (
        <img src={url} alt="" className="h-24 w-40 shrink-0 rounded-xl bg-paper object-cover ring-1 ring-stone-900/10" />
      ) : (
        <span aria-hidden className="h-24 w-40 shrink-0 rounded-xl border border-dashed border-stone-300 bg-stone-100" />
      )}
      <div>
        <p className="text-sm font-medium text-stone-700">{kind === 'photo' ? 'Portrait' : 'Cover picture'}</p>
        <label className="mt-1 inline-block cursor-pointer rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 focus-within:outline-2 focus-within:outline-stone-900">
          {busy ? 'Uploading…' : url ? `Change ${what}` : `Add a ${what}`}
          <input
            id={`ill-${kind}`}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void choose(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={() => void setPicture({ id: illustrator._id, kind, storageId: null })}
            className="ml-3 text-sm text-stone-500 underline-offset-4 hover:underline"
          >
            Remove
          </button>
        )}
        <p className="mt-1 text-sm text-stone-500">
          {kind === 'photo'
            ? 'Optional. Shown in a circle; square pictures look best.'
            : 'Optional. The wide banner at the top of their page; without one, it shows the blue watercolour texture.'}
        </p>
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
