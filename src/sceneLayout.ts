// Where a scene's pictures go among its text, on the story page and in reading mode: two pictures never
// follow each other, there is always text between them. A scene's pictures are spread through its
// paragraphs, the last one after the last paragraph. When a scene has more pictures than paragraphs, a
// paragraph is divided between sentences to make room. Only when the text runs out of sentences (a
// scene of one sentence with three pictures) do pictures meet; nothing is ever dropped.

export type SceneBlock = { kind: 'text'; text: string; index: number } | { kind: 'picture'; index: number }

export function paragraphsOf(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// Sentence ends: . ! ? or … (with any closing quote or bracket), then space and a capital or opening
// quote. Common abbreviations ("St. Martin") are not ends.
const SENTENCE_END = /(?<!\b(?:St|Dr|Mr|Mrs|Ms|Mt|Nr|vol|pp?|ca|cf)\.)(?<=[.!?…]['’"”»)\]]*)\s+(?=['‘"“„«(]?[A-ZÀ-ÞĀ-ſ])/u

export function sentencesOf(paragraph: string) {
  return paragraph.split(SENTENCE_END).filter(Boolean)
}

// Divides the longest dividable paragraph at its middle sentence, until there are `needed` pieces or
// nothing more can be divided.
function divideTo(paragraphs: string[], needed: number) {
  const pieces = paragraphs.map(sentencesOf)
  while (pieces.length < needed) {
    let longest = -1
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].length > 1 && (longest < 0 || pieces[i].length > pieces[longest].length)) longest = i
    }
    if (longest < 0) break
    const sentences = pieces[longest]
    const half = Math.ceil(sentences.length / 2)
    pieces.splice(longest, 1, sentences.slice(0, half), sentences.slice(half))
  }
  return pieces.map((sentences) => sentences.join(' '))
}

// `lead`: the story's first scene, whose first picture comes right after its first paragraph (a story
// always begins with text); its other pictures are spread through the rest.
export function layoutScene(text: string, pictureCount: number, lead = false): SceneBlock[] {
  const paragraphs = paragraphsOf(text)
  const pieces = paragraphs.length >= pictureCount ? paragraphs : divideTo(paragraphs, pictureCount)
  const n = pieces.length
  // A scene without text keeps its pictures.
  if (n === 0) return Array.from({ length: pictureCount }, (_, index) => ({ kind: 'picture', index }))

  // The pictures that follow each piece of text.
  const following: number[][] = pieces.map(() => [])
  const leading = lead && pictureCount > 0 ? 1 : 0
  if (leading) following[0].push(0)
  // The rest spread evenly over the pieces from `from` on, the last after the last piece. With more
  // pictures than pieces, the extra ones wait at the end.
  const from = leading
  const room = n - from
  const rest = pictureCount - leading
  for (let k = 1; k <= rest; k++) {
    const slot = room <= 0 ? n - 1 : from + (room >= rest ? Math.ceil((k * room) / rest) : Math.min(k, room)) - 1
    following[slot].push(leading + k - 1)
  }

  return pieces.flatMap((piece, i) => [
    { kind: 'text' as const, text: piece, index: i },
    ...following[i].map((index) => ({ kind: 'picture' as const, index })),
  ])
}

// A scene with pictures and no text (the importer's overflow when a scene has more pictures than one scene
// may hold) is shown as part of the scene before it, with no divider, so its pictures are spread through
// that scene's text too.
export function joinPictureOnlyScenes<S extends { text: string; illustrations: unknown[] }>(scenes: S[]): S[] {
  const joined: S[] = []
  for (const scene of scenes) {
    const before = joined[joined.length - 1]
    if (before && !scene.text.trim()) {
      joined[joined.length - 1] = { ...before, illustrations: [...before.illustrations, ...scene.illustrations] }
    } else joined.push(scene)
  }
  return joined
}
