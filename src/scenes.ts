import type { Id } from '../convex/_generated/dataModel'

// A scene being written in the form. `url` is only for showing the picture while editing.
export type DraftScene = {
  id: string
  text: string
  illustrations: { storageId: Id<'_storage'>; alt: string; credit: string; url: string | null }[]
}

// Scenes from the server (with picture URLs) as form drafts.
export function draftsFromScenes(
  scenes: { id: string; text: string; illustrations: { storageId: Id<'_storage'>; alt: string; credit?: string; url: string | null }[] }[],
): DraftScene[] {
  return scenes.map((s) => ({
    ...s,
    illustrations: s.illustrations.map((i) => ({ ...i, credit: i.credit ?? '' })),
  }))
}

// What the server accepts.
export function scenesForSubmit(drafts: DraftScene[]) {
  return drafts.map((s) => ({
    id: s.id,
    text: s.text,
    illustrations: s.illustrations.map((i) => ({
      storageId: i.storageId,
      alt: i.alt.trim(),
      credit: i.credit.trim() || undefined,
    })),
  }))
}

// A problem to fix before submitting, or null.
export function scenesProblem(drafts: DraftScene[]) {
  if (!drafts.some((s) => s.text.trim())) return 'Write your story before submitting.'
  const empty = drafts.findIndex((s) => !s.text.trim() && s.illustrations.length === 0)
  if (empty >= 0) return `Scene ${empty + 1} is empty. Add text or a picture, or remove it.`
  const undescribed = drafts.findIndex((s) => s.illustrations.some((i) => !i.alt.trim()))
  if (undescribed >= 0) return `Describe each picture in scene ${undescribed + 1} for readers who can't see it.`
  return null
}

function newSceneId(existing: DraftScene[]) {
  let id: string
  do id = `s${Math.random().toString(36).slice(2, 8)}`
  while (existing.some((s) => s.id === id))
  return id
}

export function emptyScene(existing: DraftScene[] = []): DraftScene {
  return { id: newSceneId(existing), text: '', illustrations: [] }
}
