// Gives curated legends a picture: each file becomes the legend's cover and the illustration after its
// text. Running it again replaces the picture (the old file is deleted). See setPicture in
// convex/legends.ts. The list is a JSON file next to the pictures:
//
//   [{ "importId": "legend-93", "file": "giant.jpg", "alt": "…", "credit": "…" }, …]
//
// Add "use": "cover" or "use": "illustration" to set only one of the two and keep the other.
//
//   node scripts/legend-pictures.ts <pictures.json>           # your dev deployment
//   node scripts/legend-pictures.ts <pictures.json> --prod    # production
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

type Picture = { importId: string; file: string; alt: string; credit?: string; use?: 'cover' | 'illustration' }

const listPath = process.argv[2]
if (!listPath || listPath.startsWith('--')) {
  console.error('Usage: node scripts/legend-pictures.ts <pictures.json> [--prod]')
  process.exit(1)
}
const prod = process.argv.includes('--prod')
const pictures = JSON.parse(readFileSync(listPath, 'utf8')) as Picture[]
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

function convex(fn: string, args: object): string {
  const result = spawnSync('npx', ['convex', 'run', fn, JSON.stringify(args), ...(prod ? ['--prod'] : [])], {
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`${fn} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

for (const picture of pictures) {
  const path = resolve(dirname(listPath), picture.file)
  const type = TYPES[extname(path).toLowerCase()]
  if (!type) throw new Error(`${picture.file}: use a .jpg, .png, or .webp file`)
  const uploadUrl = JSON.parse(convex('legends:pictureUploadUrl', {})) as string
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': type }, body: readFileSync(path) })
  if (!response.ok) throw new Error(`Uploading ${picture.file} failed: ${response.status}`)
  const { storageId } = (await response.json()) as { storageId: string }
  convex('legends:setPicture', { importId: picture.importId, storageId, alt: picture.alt, credit: picture.credit, use: picture.use })
  console.log(`${picture.importId}: ${picture.file}${picture.use ? ` (${picture.use} only)` : ''}`)
}
