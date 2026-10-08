// Imports the curated legends (src/data/europeanLegends.ts) into Convex as published stories.
// Safe to run again: it updates the same stories and keeps their codes. See convex/legends.ts.
//
//   node scripts/import-legends.ts           # your dev deployment
//   node scripts/import-legends.ts --prod    # production
import { spawnSync } from 'node:child_process'
import { EUROPEAN_LEGENDS } from '../src/data/europeanLegends.ts'

const CATEGORY = { 'true-tale': 'true_tale', legend: 'legend', 'wonder-tale': 'wonder_tale' } as const
const RETIRED = new Set(['sea', 'forest', 'adventure', 'mystery', 'family'])

const legends = EUROPEAN_LEGENDS.filter((l) => l.status === 'published').map((l) => {
  if (!l.category || !l.ageRange || !l.source || !l.place) throw new Error(`${l.id} is missing a category, age, source, or place`)
  const { author, title, date, url } = l.source
  const detail = [author, title, date].filter(Boolean).join(', ')
  return {
    importId: l.id,
    story: {
      title: l.title,
      scenes: [{ id: 's1', text: l.shortDescription, illustrations: [] }],
      cover: { kind: 'colors' },
      location: { lat: l.latitude, lng: l.longitude, place: l.place, precision: l.locationType },
      category: CATEGORY[l.category],
      ageRange: l.ageRange,
      themes: (l.themes ?? []).filter((t) => !RETIRED.has(t)),
      source: { kind: 'reference', detail: detail.length > 300 ? `${detail.slice(0, 299)}…` : detail, url },
    },
  }
})

const prod = process.argv.includes('--prod')
const args = ['convex', 'run', 'legends:importLegends', JSON.stringify({ legends }), ...(prod ? ['--prod'] : [])]
const result = spawnSync('npx', args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
