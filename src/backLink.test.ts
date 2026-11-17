import { describe, expect, test } from 'vitest'
import { shortLabel } from './backLink'

describe('shortLabel', () => {
  test('keeps short names', () => {
    expect(shortLabel('Kwame Asante-Lind')).toBe('Kwame Asante-Lind')
    expect(shortLabel('Stories in Eppstein')).toBe('Stories in Eppstein')
  })
  test('cuts long titles at a word', () => {
    expect(shortLabel('The Blood Linden of Frauenstein')).toBe('The Blood Linden of Frauenstein')
    expect(shortLabel('The Washerwoman of the Burgberg and Her Seven Sons')).toBe('The Washerwoman of the Burgberg and…')
  })
})
