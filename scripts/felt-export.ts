// Exports every published story that has a place as a GeoJSON file for Felt (felt.com), with a link
// back to each story's page in the app.
//
//   node scripts/felt-export.ts https://your-app.vercel.app            # from your dev deployment
//   node scripts/felt-export.ts https://your-app.vercel.app --prod     # from production
//
// Writes storyplace-stories.geojson to your Downloads folder. Links use the story's permanent code
// (see convex/storyCodes.ts), so they keep working if a story is renamed later.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { categoryLabel, themeLabel, type StoredTheme, type StoryCategory } from '../convex/taxonomy.ts'
import { coverColor } from '../src/mapStories.ts'
import { storyPath } from '../src/storyLinks.ts'

type Exported = {
  _id: string
  code?: string
  title: string
  body: string
  category?: StoryCategory
  ageRange?: string
  themes: StoredTheme[]
  location: { lat: number; lng: number; place?: string; precision?: string }
  source?: { kind: string; detail?: string; url?: string }
}

const base = process.argv[2]?.replace(/\/+$/, '')
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Give the app’s web address, e.g. node scripts/felt-export.ts https://your-app.vercel.app')
  process.exit(1)
}
const prod = process.argv.includes('--prod')
const run = spawnSync('npx', ['convex', 'run', 'legends:forExport', ...(prod ? ['--prod'] : [])], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
if (run.status !== 0) {
  console.error(run.stderr)
  process.exit(run.status ?? 1)
}
const stories: Exported[] = JSON.parse(run.stdout)

const PRECISION: Record<string, string> = { exact: 'Exact site', area: 'General area', uncertain: 'Uncertain' }
const features = stories.map((s) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [s.location.lng, s.location.lat] },
  properties: {
    title: s.title,
    link: base + storyPath(s),
    code: s.code ?? '',
    category: s.category ? categoryLabel(s.category) : '',
    color: coverColor(s.category),
    topics: s.themes.map(themeLabel).join(', '),
    age: s.ageRange ?? '',
    description: s.body.length > 500 ? `${s.body.slice(0, 499)}…` : s.body,
    place: s.location.place ?? '',
    location_precision: PRECISION[s.location.precision ?? 'exact'],
    source: s.source?.detail ?? '',
    source_url: s.source?.url ?? '',
  },
}))

const out = join(homedir(), 'Downloads', 'storyplace-stories.geojson')
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }, null, 1))
console.log(`Wrote ${features.length} stories to ${out}`)
