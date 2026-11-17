import { describe, expect, test } from 'vitest'
import { joinPictureOnlyScenes, layoutScene, sentencesOf, type SceneBlock } from './sceneLayout'

const shape = (blocks: SceneBlock[]) => blocks.map((b) => (b.kind === 'text' ? 'T' : `P${b.index}`)).join(' ')
const neighbours = (blocks: SceneBlock[]) => blocks.some((b, i) => b.kind === 'picture' && blocks[i + 1]?.kind === 'picture')

describe('layoutScene', () => {
  test('one picture follows the text', () => {
    expect(shape(layoutScene('One.\n\nTwo.', 1))).toBe('T T P0')
  })

  test('pictures are spread through the paragraphs, the last at the end', () => {
    expect(shape(layoutScene('A.\n\nB.\n\nC.\n\nD.', 2))).toBe('T T P0 T T P1')
    expect(shape(layoutScene('A.\n\nB.\n\nC.', 3))).toBe('T P0 T P1 T P2')
  })

  test('a paragraph is divided between sentences when there are more pictures than paragraphs', () => {
    const blocks = layoutScene('She met him. It was by a gate. Only she had the key.', 2)
    expect(shape(blocks)).toBe('T P0 T P1')
    expect(blocks.filter((b) => b.kind === 'text').map((b) => (b as { text: string }).text)).toEqual([
      'She met him. It was by a gate.',
      'Only she had the key.',
    ])
  })

  test('the first scene begins with text, its first picture right after the first paragraph', () => {
    expect(shape(layoutScene('A.\n\nB.\n\nC.\n\nD.', 1, true))).toBe('T P0 T T T')
    expect(shape(layoutScene('A.\n\nB.\n\nC.\n\nD.', 2, true))).toBe('T P0 T T T P1')
    expect(shape(layoutScene('A. B. C.', 3, true))).toBe('T P0 T P1 T P2')
    expect(shape(layoutScene('Only one.', 2, true))).toBe('T P0 P1')
  })

  test('pictures only meet when the text has no more sentences, and none are dropped', () => {
    const blocks = layoutScene('Only one sentence.', 3)
    expect(shape(blocks)).toBe('T P0 P1 P2')
    expect(neighbours(layoutScene('A. B. C. D.', 4))).toBe(false)
  })

  test('a scene without text keeps its pictures', () => {
    expect(shape(layoutScene('', 2))).toBe('P0 P1')
  })
})

describe('sentencesOf', () => {
  test('quotes and abbreviations', () => {
    expect(sentencesOf('“Go!” he said. St. Martin came. Then night.')).toEqual(['“Go!” he said.', 'St. Martin came.', 'Then night.'])
  })
})

describe('joinPictureOnlyScenes', () => {
  test('a scene of only pictures joins the scene before it', () => {
    const scenes = [
      { id: 's1', text: 'A. B. C.', illustrations: ['a', 'b'] },
      { id: 's1-4', text: '', illustrations: ['c'] },
      { id: 's2', text: 'D.', illustrations: [] },
    ]
    expect(joinPictureOnlyScenes(scenes)).toEqual([
      { id: 's1', text: 'A. B. C.', illustrations: ['a', 'b', 'c'] },
      { id: 's2', text: 'D.', illustrations: [] },
    ])
  })
})
