// Loads full stories from a folder of story folders (each `093-giant-of-eppstein/story.md` with its
// `images/`) onto the curated legends with the same number, keeping their codes and links. Only the
// "## Older" version is loaded for now. Pictures whose description starts with PLACEHOLDER are skipped,
// so a story's existing pictures stay. See convex/legends.ts.
//
//   node scripts/import-story-folders.ts <folder>           # your dev deployment
//   node scripts/import-story-folders.ts <folder> --prod    # production
//   node scripts/import-story-folders.ts <folder> --only=093    # just that story, with or without --prod
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

type Picture = { alt: string; file: string; credit?: string }

const MAX_PICTURES_PER_SCENE = 4 // convex/scenes.ts
const CATEGORY: Record<string, string> = { 'true tale': 'true_tale', legend: 'legend', 'wonder tale': 'wonder_tale' }
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const folder = process.argv[2]
if (!folder || folder.startsWith('--')) {
  console.error('Usage: node scripts/import-story-folders.ts <folder> [--prod]')
  process.exit(1)
}
const prod = process.argv.includes('--prod')
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7)

function convex(fn: string, args: object): string {
  const result = spawnSync('npx', ['convex', 'run', fn, JSON.stringify(args), ...(prod ? ['--prod'] : [])], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${fn} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

async function upload(dir: string, file: string): Promise<string> {
  const type = TYPES[extname(file).toLowerCase()]
  if (!type) throw new Error(`${file}: use a .jpg, .png, or .webp file`)
  const url = JSON.parse(convex('legends:pictureUploadUrl', {})) as string
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body: readFileSync(join(dir, file)) })
  if (!response.ok) throw new Error(`Uploading ${file} failed: ${response.status}`)
  return ((await response.json()) as { storageId: string }).storageId
}

function field(text: string, name: string) {
  return text.match(new RegExp(`^${name}: *(.*)$`, 'm'))?.[1].trim() ?? ''
}

function picture(line: string): Picture | null {
  const match = line.match(/^!\[(.*)\]\((.+)\)$/)
  return match && !match[1].startsWith('PLACEHOLDER') ? { alt: match[1], file: match[2] } : null
}

// One scene for each "### Scene", from its text lines and pictures. A scene with more pictures than the
// app allows continues in scenes holding only pictures.
function scenesIn(older: string) {
  return older.split(/^### .*$/m).slice(1).flatMap((part, s) => {
    const lines = part.split('\n')
    const pictures = lines.map(picture).filter((p) => p !== null)
    const text = lines
      .filter((line) => !line.startsWith('![') && !line.startsWith('**RU**'))
      .map((line) => line.replace(/^\*\*EN\*\* */, ''))
      .join('\n')
      .trim()
    const scenes = [{ id: `s${s + 1}`, text, pictures: pictures.slice(0, MAX_PICTURES_PER_SCENE) }]
    for (let i = MAX_PICTURES_PER_SCENE; i < pictures.length; i += MAX_PICTURES_PER_SCENE) {
      scenes.push({ id: `s${s + 1}-${i}`, text: '', pictures: pictures.slice(i, i + MAX_PICTURES_PER_SCENE) })
    }
    return scenes
  })
}

const legends = []
const covers: { importId: string; dir: string; cover: Picture }[] = []
for (const name of readdirSync(folder).filter((f) => /^\d{3}-/.test(f) && (!only || f.startsWith(`${only}-`))).sort()) {
  const dir = resolve(folder, name)
  const md = readFileSync(join(dir, 'story.md'), 'utf8')
  const importId = `legend-${String(Number(name.slice(0, 3))).padStart(2, '0')}`
  const older = md.match(/^## Older.*$([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1]
  if (!older) throw new Error(`${name} has no "## Older" section`)

  const [lat, lng] = field(md, 'Map position').split(',').map(Number)
  const category = CATEGORY[field(md, 'Type')]
  const ageRange = field(md, 'Age')
  if (!category || !ageRange || !lat || !lng) throw new Error(`${name} is missing its type, age, or map position`)

  const detail = field(md, 'Source')
  const scenes = []
  for (const scene of scenesIn(older)) {
    const illustrations = []
    for (const p of scene.pictures) illustrations.push({ storageId: await upload(dir, p.file), alt: p.alt, credit: p.credit })
    scenes.push({ id: scene.id, text: scene.text, illustrations })
  }
  legends.push({
    importId,
    story: {
      title: md.match(/^# (.*)$/m)![1].split(' / ')[0].trim(),
      scenes,
      cover: { kind: 'colors' },
      location: { lat, lng, place: field(md, 'Place'), precision: field(md, 'Position is') },
      category,
      ageRange,
      themes: field(md, 'Topics').split(',').map((t) => t.trim()).filter(Boolean),
      source: { kind: 'reference', detail: detail.length > 300 ? `${detail.slice(0, 299)}…` : detail, url: field(md, 'Source link') },
    },
  })
  const cover = md.slice(0, md.indexOf('## Older')).split('\n').map(picture).find((p) => p !== null && p !== undefined)
  if (cover) covers.push({ importId, dir, cover })
  console.log(`${name}: ${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.illustrations.length, 0)} pictures`)
}

console.log(convex('legends:importLegends', { legends }))
for (const { importId, dir, cover } of covers) {
  convex('legends:setPicture', { importId, storageId: await upload(dir, cover.file), alt: cover.alt, use: 'cover' })
  console.log(`${importId}: cover set`)
}
