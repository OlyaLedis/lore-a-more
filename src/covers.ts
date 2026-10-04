import type { Id } from '../convex/_generated/dataModel'
import type { DraftScene } from './scenes'

export const COVER_SCALE = { min: 0.5, max: 3 }
export const COVER_OFFSET = 0.5

// The cover being chosen in the story form.
export type CoverDraft =
  | { kind: 'colors' }
  | {
      kind: 'image'
      // A picture from the story's scenes, or a separately uploaded cover.
      source: 'scene' | 'upload'
      storageId: Id<'_storage'>
      url: string | null
      // For uploads; a scene picture's description and credit come from the scene.
      alt: string
      credit: string
      scale: number
      x: number
      y: number
    }

type SavedCover =
  | { kind: 'colors' }
  | { kind: 'image'; storageId: Id<'_storage'>; alt: string; credit?: string; scale: number; x: number; y: number; url: string | null }
  | null

const sceneIllustrations = (scenes: DraftScene[]) => scenes.flatMap((s) => s.illustrations)

export function coverFromScene(ill: DraftScene['illustrations'][number]): CoverDraft {
  return { kind: 'image', source: 'scene', storageId: ill.storageId, url: ill.url, alt: ill.alt, credit: ill.credit, scale: 1, x: 0, y: 0 }
}

// The form's starting cover. Stories that never chose one start with what their card already shows:
// the first picture, or the colorful cover.
export function initialCover(saved: SavedCover, scenes: DraftScene[]): CoverDraft {
  if (saved?.kind === 'colors') return { kind: 'colors' }
  if (saved?.kind === 'image') {
    const inScenes = sceneIllustrations(scenes).some((i) => i.storageId === saved.storageId)
    return {
      kind: 'image',
      source: inScenes ? 'scene' : 'upload',
      storageId: saved.storageId,
      url: saved.url,
      alt: saved.alt,
      credit: saved.credit ?? '',
      scale: saved.scale,
      x: saved.x,
      y: saved.y,
    }
  }
  const first = sceneIllustrations(scenes)[0]
  return first ? coverFromScene(first) : { kind: 'colors' }
}

// If the chosen scene picture was removed from the story, fall back to the colorful cover.
export function effectiveCover(draft: CoverDraft, scenes: DraftScene[]): CoverDraft {
  if (draft.kind === 'image' && draft.source === 'scene') {
    const ill = sceneIllustrations(scenes).find((i) => i.storageId === draft.storageId)
    if (!ill) return { kind: 'colors' }
    // Keep the scene's current description, credit, and preview.
    return { ...draft, alt: ill.alt, credit: ill.credit, url: ill.url }
  }
  return draft
}

export function coverForSubmit(draft: CoverDraft) {
  if (draft.kind === 'colors') return { kind: 'colors' as const }
  const { storageId, alt, credit, scale, x, y } = draft
  return { kind: 'image' as const, storageId, alt: alt.trim(), credit: credit.trim() || undefined, scale, x, y }
}

export function coverProblem(draft: CoverDraft) {
  if (draft.kind === 'image' && !draft.alt.trim()) {
    return draft.source === 'scene'
      ? 'Describe the cover picture in its scene, so readers who can’t see it know what it shows.'
      : 'Describe the cover picture for readers who can’t see it.'
  }
  return null
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
