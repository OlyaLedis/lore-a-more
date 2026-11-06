// Loads character cards from a folder of card files (`giant-of-eppstein-8.md`, made with
// character-card-prompt.md) and links each to the curated legends it names. Only cards marked
// "Status: reviewed" are loaded; --drafts also loads drafts, on the dev deployment only, to see them.
// See convex/characters.ts.
//
//   node scripts/import-character-cards.ts <folder>              # your dev deployment
//   node scripts/import-character-cards.ts <folder> --drafts     # dev, drafts too
//   node scripts/import-character-cards.ts <folder> --prod       # production
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Card = {
  character: string
  region: string
  age_level: string
  name: { local_name: { text: string } }
  beliefs: { text: string }[]
  typical_plots: { text: string }[]
  ask_your_listener: { question: string }[]
}

const folder = process.argv[2]
if (!folder || folder.startsWith('--')) {
  console.error('Usage: node scripts/import-character-cards.ts <folder> [--drafts | --prod]')
  process.exit(1)
}
const prod = process.argv.includes('--prod')
const drafts = process.argv.includes('--drafts')
if (prod && drafts) {
  console.error('Drafts are never loaded onto production.')
  process.exit(1)
}

function field(text: string, name: string) {
  return text.match(new RegExp(`^${name}: *(.*)$`, 'm'))?.[1].trim() ?? ''
}

for (const name of readdirSync(folder).filter((f) => f.endsWith('.md')).sort()) {
  const md = readFileSync(join(folder, name), 'utf8')
  const status = field(md, 'Status')
  if (status !== 'reviewed' && !(drafts && status === 'draft')) {
    console.log(`${name}: skipped (Status: ${status || 'none'})`)
    continue
  }
  const input = md.match(/^## Input[\s\S]*?```\n([\s\S]*?)```/m)?.[1] ?? ''
  const json = md.match(/^## Output[\s\S]*?```json\n([\s\S]*?)```/m)?.[1]
  if (!json) throw new Error(`${name} has no JSON block under "## Output"`)
  const card = JSON.parse(json) as Card
  const sources = [...input.matchAll(/^\[S\d+\] *(.+)$/gm)].map((m) => m[1].trim())
  const storyImportIds = field(md, 'Stories')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => `legend-${String(Number(n)).padStart(2, '0')}`)

  const args = {
    card: {
      slug: field(md, 'Slug'),
      name: card.character,
      localName: card.name.local_name.text,
      region: card.region,
      ageRange: card.age_level,
      beliefs: card.beliefs.map((b) => b.text),
      plots: card.typical_plots.map((p) => p.text),
      questions: card.ask_your_listener.map((q) => q.question),
      sources,
    },
    storyImportIds,
  }
  const result = spawnSync('npx', ['convex', 'run', 'characters:importCard', JSON.stringify(args), ...(prod ? ['--prod'] : [])], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${name} failed:\n${result.stderr}`)
  console.log(`${name}: ${result.stdout.trim()}`)
}
