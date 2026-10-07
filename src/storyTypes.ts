// Each story type's symbol, so types can be told apart without relying on colour (orange and pink
// look alike to many people). Shared by the map legend and the map pins. Drawn on a 24×24 grid as
// strokes, like the other icons.
import type { StoryCategory } from '../convex/taxonomy'
import { PIN_COLORS } from './mapStyle'

export type StoryType = StoryCategory | 'none'

export const TYPE_SYMBOLS: Record<StoryType, { name: string; paths: string[] }> = {
  local_legend: { name: 'crown', paths: ['M4 18h16', 'M5 18 3.5 8.5l5 3.5L12 5l3.5 7 5-3.5L19 18'] },
  place: {
    name: 'castle tower',
    paths: ['M6.5 21V8.5h2.2V5.5h2.1v3h2.4v-3h2.1v3h2.2V21z', 'M10 21v-3.5a2 2 0 0 1 4 0V21'],
  },
  folktale: {
    name: 'open book',
    paths: ['M12 6.5C10.3 5.3 8 4.7 4 4.8v13.4c4-.1 6.3.5 8 1.7 1.7-1.2 4-1.8 8-1.7V4.8c-4-.1-6.3.5-8 1.7z', 'M12 6.5v13.4'],
  },
  personal: { name: 'heart', paths: ['M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z'] },
  none: { name: 'pin', paths: ['M12 20.5s-6-5.6-6-10.3a6 6 0 0 1 12 0c0 4.7-6 10.3-6 10.3z', 'M12 8.7v3'] },
}

// The HTML of a round map pin: the type's colour with its white symbol. Used for Leaflet div icons,
// which take an HTML string; styled by .sp-pin in index.css.
export function pinHtml(type: StoryType, size: number) {
  const symbol = TYPE_SYMBOLS[type]
  const icon = Math.round(size * 0.56)
  const paths = symbol.paths.map((d) => `<path d="${d}"/>`).join('')
  return `<div class="sp-pin" style="width:${size}px;height:${size}px;background:${PIN_COLORS[type]}"><svg viewBox="0 0 24 24" width="${icon}" height="${icon}" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg></div>`
}
