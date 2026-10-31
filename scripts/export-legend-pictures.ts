// Saves the curated legends' pictures from a deployment into a folder, with a pictures.json that
// scripts/legend-pictures.ts reads, so they can be put on another deployment (dev → production):
//
//   node scripts/export-legend-pictures.ts <folder>           # from your dev deployment
//   node scripts/legend-pictures.ts <folder>/pictures.json --prod
//
// It only reads. A legend whose cover is its illustration gets one entry; one with a cover of its own
// gets two ("use": "illustration" and "use": "cover"). Keep the folder outside the repo.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

type Picture = { storageId: string; url: string; alt: string; credit?: string }
type Legend = { importId: string; title: string; cover: Picture | null; illustration: Picture | null }

const folder = process.argv[2]
if (!folder || folder.startsWith('--')) {
  console.error('Usage: node scripts/export-legend-pictures.ts <folder>')
  process.exit(1)
}
const result = spawnSync('npx', ['convex', 'run', 'legends:pictureList', '{}'], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(`legends:pictureList failed:\n${result.stderr}`)
const legends = JSON.parse(result.stdout) as Legend[]

const EXTENSIONS: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
mkdirSync(resolve(folder), { recursive: true })
const list: object[] = []

async function save(legend: Legend, picture: Picture, use?: 'cover' | 'illustration') {
  const response = await fetch(picture.url)
  if (!response.ok) throw new Error(`Downloading ${legend.importId} failed: ${response.status}`)
  const extension = EXTENSIONS[response.headers.get('content-type') ?? '']
  if (!extension) throw new Error(`${legend.importId}: unexpected file type ${response.headers.get('content-type')}`)
  const file = `${legend.importId}${use ? `-${use}` : ''}${extension}`
  writeFileSync(join(resolve(folder), file), Buffer.from(await response.arrayBuffer()))
  list.push({ importId: legend.importId, file, alt: picture.alt, credit: picture.credit, ...(use && { use }) })
  console.log(`${legend.importId} (${legend.title}): ${file}`)
}

for (const legend of legends) {
  const { cover, illustration } = legend
  if (cover && illustration && cover.storageId === illustration.storageId) await save(legend, cover)
  else {
    if (illustration) await save(legend, illustration, 'illustration')
    if (cover) await save(legend, cover, 'cover')
  }
}
writeFileSync(join(resolve(folder), 'pictures.json'), JSON.stringify(list, null, 2) + '\n')
console.log(`${list.length} pictures, listed in ${join(resolve(folder), 'pictures.json')}`)
