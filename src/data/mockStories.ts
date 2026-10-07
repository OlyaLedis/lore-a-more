// Mock dataset for the map prototype: 1,100 published stories. The first 100 are hand-written or spread
// across Europe; 1,000 more sit around towns to see how the map looks when busy. Drafts would never be
// drawn, but none are left. Placeholder titles and descriptions. Not real stories.
import type { MapCategory, MapStory } from '../mapStories'

const PUBLISHED: MapStory[] = [
  { id: 'mock-001', title: 'The Giant of Eppstein Castle', category: 'local-legend', latitude: 50.1404, longitude: 8.3932, status: 'published', shortDescription: 'How a knight caught a giant in an iron net below the castle rock.', locationType: 'exact' },
  { id: 'mock-002', title: 'The Janas of Sadali', category: 'local-legend', latitude: 39.8133, longitude: 9.2719, status: 'published', shortDescription: 'Three tiny fairies who weave gold in the caves by the waterfall.', locationType: 'area' },
  { id: 'mock-003', title: 'The Drowned Bells of the Lake', category: 'local-legend', latitude: 47.6502, longitude: 9.3604, status: 'published', shortDescription: 'On still nights, fishermen still hear a village church ringing under the water.', locationType: 'area' },
  { id: 'mock-004', title: 'The Bakery by the Harbour', category: 'story-of-place', latitude: 39.2238, longitude: 9.1217, status: 'published', shortDescription: 'A hundred years of bread, flour, and gossip in a tiny shop near the harbour.', locationType: 'exact' },
  { id: 'mock-005', title: 'The Keeper of Capo Testa', category: 'folktale-myth', latitude: 41.2450, longitude: 9.1440, status: 'published', shortDescription: 'Why the lighthouse keeper set a place at the table for the sea every winter.', locationType: 'exact' },
  { id: 'mock-006', title: 'The Salt Pans at Dusk', category: 'story-of-place', latitude: 39.2350, longitude: 9.1550, status: 'published', shortDescription: 'Why the flamingos come back to the old salt works every spring.', locationType: 'area' },
  { id: 'mock-007', title: 'The Stone Tower of Barumini', category: 'story-of-place', latitude: 39.7064, longitude: 8.9910, status: 'published', shortDescription: 'A 3,500-year-old fortress hidden under a hill until a flood revealed it.', locationType: 'exact' },
  { id: 'mock-008', title: 'The Old Mill on the Schwarzbach', category: 'story-of-place', latitude: 50.0850, longitude: 8.4470, status: 'published', shortDescription: 'Four hundred years of grinding grain beside a forest stream.', locationType: 'exact' },
  { id: 'mock-009', title: 'The Fox Who Married the Moon', category: 'folktale-myth', latitude: 40.3200, longitude: 9.3300, status: 'published', shortDescription: 'A shepherd’s tale of a clever fox and a very long night.', locationType: 'uncertain' },
  { id: 'mock-010', title: 'The Weather Witch of the Taunus', category: 'folktale-myth', latitude: 50.2200, longitude: 8.4500, status: 'published', shortDescription: 'Why villagers left bread on the hill before the harvest storms.', locationType: 'area' },
]

// 90 more placeholders spread across Europe, the same every run.
const CATEGORIES: MapCategory[] = ['local-legend', 'story-of-place', 'folktale-myth']
const SUBJECTS = ['Bridge', 'Well', 'Chapel', 'Orchard', 'Harbour', 'Forest', 'Mill', 'Tower', 'Valley', 'Market', 'Cave', 'Island']
const TWISTS = ['That Sang at Night', 'Nobody Could Cross', 'of the Seven Brothers', 'Under the Snow', 'and the Lost Key', 'by the Old Road']
const TYPES: MapStory['locationType'][] = ['exact', 'area', 'uncertain']

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = seeded(2026)
const SPREAD: MapStory[] = Array.from({ length: 90 }, (_, i) => {
  const n = i + 11
  const subject = SUBJECTS[i % SUBJECTS.length]
  return {
    id: `mock-${String(n).padStart(3, '0')}`,
    title: `The ${subject} ${TWISTS[i % TWISTS.length]}`,
    category: CATEGORIES[i % CATEGORIES.length],
    latitude: Math.round((38 + random() * 16) * 10000) / 10000,
    longitude: Math.round((-4 + random() * 24) * 10000) / 10000,
    status: 'published',
    shortDescription: `A story about a ${subject.toLowerCase()} and the people who remember it.`,
    locationType: TYPES[i % TYPES.length],
  }
})

// 1,000 more published stories, each near one of these towns (within about 25 km), so they fall on land.
const TOWNS: [string, number, number][] = [
  ['Eppstein', 50.14, 8.39], ['Heidelberg', 49.41, 8.69], ['Würzburg', 49.79, 9.95], ['Bamberg', 49.89, 10.89],
  ['Freiburg', 47.99, 7.85], ['Trier', 49.75, 6.64], ['Marburg', 50.81, 8.77], ['Goslar', 51.91, 10.43],
  ['Quedlinburg', 51.79, 11.15], ['Lübeck', 53.87, 10.69], ['Dresden', 51.05, 13.74], ['Regensburg', 49.01, 12.10],
  ['Salzburg', 47.80, 13.04], ['Hallstatt', 47.56, 13.65], ['Innsbruck', 47.27, 11.40], ['Lucerne', 47.05, 8.31],
  ['Bern', 46.95, 7.45], ['Colmar', 48.08, 7.36], ['Strasbourg', 48.57, 7.75], ['Reims', 49.26, 4.03],
  ['Rouen', 49.44, 1.10], ['Mont-Saint-Michel', 48.64, -1.51], ['Carnac', 47.58, -3.08], ['Tours', 47.39, 0.69],
  ['Carcassonne', 43.21, 2.35], ['Arles', 43.68, 4.63], ['Annecy', 45.90, 6.13], ['Le Puy', 45.04, 3.88],
  ['Bruges', 51.21, 3.22], ['Ghent', 51.05, 3.72], ['Utrecht', 52.09, 5.12], ['Luxembourg', 49.61, 6.13],
  ['Toledo', 39.86, -4.02], ['Segovia', 40.95, -4.12], ['Granada', 37.18, -3.60], ['Santiago', 42.88, -8.55],
  ['Cuenca', 40.07, -2.14], ['Évora', 38.57, -7.91], ['Sintra', 38.80, -9.38], ['Porto', 41.15, -8.61],
  ['Siena', 43.32, 11.33], ['Orvieto', 42.72, 12.11], ['Matera', 40.67, 16.60], ['Bologna', 44.49, 11.34],
  ['Verona', 45.44, 10.99], ['Aosta', 45.74, 7.32], ['Sadali', 39.81, 9.27], ['Nuoro', 40.32, 9.33],
  ['Oristano', 39.90, 8.59], ['Sassari', 40.73, 8.56], ['Cagliari', 39.22, 9.12], ['Palermo', 38.12, 13.36],
  ['Kraków', 50.06, 19.94], ['Wrocław', 51.11, 17.03], ['Prague', 50.08, 14.42], ['Český Krumlov', 48.81, 14.32],
  ['Bratislava', 48.15, 17.11], ['Eger', 47.90, 20.38], ['Ljubljana', 46.06, 14.51], ['Brașov', 45.66, 25.61],
]
const MORE_TITLES: Record<MapCategory, [string[], string[]]> = {
  'local-legend': [['The White Lady', 'The Stone Knight', 'The Wolf Bride', 'The Black Hound', 'The Sleeping Giant', 'The Silver Stag'], ['of the Ruins', 'Below the Bridge', 'of the Old Gate', 'in the Well', 'on the Hill']],
  'story-of-place': [['The Old Market', 'The Last Ferry', 'The Salt Road', 'The Clock Tower', 'The Flooded Quarter', 'The Monastery Garden'], ['Then and Now', 'Through the Wars', 'Every Spring', 'by Lamplight', 'and Its Keepers']],
  'folktale-myth': [['The Clever Shepherd', 'The Fox and the Miller', 'The Moon’s Daughter', 'The Three Ravens', 'The Bear King', 'The Singing Stone'], ['and the North Wind', 'Who Outwitted Death', 'of the Deep Forest', 'and the Golden Pear', 'at the World’s Edge']],
}
const MORE_LINES: Record<MapCategory, string> = {
  'local-legend': 'A legend people in {town} still tell after dark.',
  'story-of-place': 'How this corner of {town} came to look the way it does.',
  'folktale-myth': 'An old tale shared around {town} for generations.',
}

const more = seeded(1000)
const MORE: MapStory[] = Array.from({ length: 1000 }, (_, i) => {
  const [town, lat, lng] = TOWNS[Math.floor(more() * TOWNS.length)]
  const category = CATEGORIES[Math.floor(more() * CATEGORIES.length)]
  const [starts, ends] = MORE_TITLES[category]
  return {
    id: `mock-${String(i + 101).padStart(4, '0')}`,
    title: `${starts[Math.floor(more() * starts.length)]} ${ends[Math.floor(more() * ends.length)]}`,
    category,
    latitude: Math.round((lat + (more() - 0.5) * 0.45) * 10000) / 10000,
    longitude: Math.round((lng + (more() - 0.5) * 0.65) * 10000) / 10000,
    status: 'published',
    shortDescription: MORE_LINES[category].replace('{town}', town),
    locationType: TYPES[Math.floor(more() * TYPES.length)],
  }
})

export const MOCK_STORIES: MapStory[] = [...PUBLISHED, ...SPREAD, ...MORE]
