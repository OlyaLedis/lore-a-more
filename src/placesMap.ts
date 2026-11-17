// Where an illustrator's stories happen, drawn as dots on their page's watercolour banner. This works
// out where each dot goes and what it's called, for a banner of a given size in pixels:
//
// - The map fits itself to the stories: three towns near Frankfurt fill the banner as well as stories
//   on three continents do. Latitudes use the Web Mercator projection, like the app's maps, so shapes
//   keep their proportions.
// - Nearby stories are named by their town ("Lorch"); stories spread across countries or continents by
//   their country ("Italy"), since town names alone wouldn't say where in the world they are.
// - Stories on both sides of the 180° meridian (Japan and California) are joined across the Pacific,
//   the short way round, instead of being pushed to opposite ends.
// - Dots that would overlap become one dot, which opens its stories on the Map tab, and a name already
//   shown close by isn't repeated. Dots keep clear of the reserved corner where the portrait overlaps the banner.

export type StoryPlace = { _id: string; code?: string; title: string; lat: number; lng: number; place: string }
export type MapDot = { x: number; y: number; label: string | null; labelLeft: boolean; stories: StoryPlace[] }

// Wider than this (in degrees of longitude or latitude), stories are named by country.
const WIDE_LNG = 12
const WIDE_LAT = 8
// The smallest area shown, in degrees, so two stories in the same town don't sit at the banner's ends.
const MIN_SPAN = 0.4
// Closer than this, in pixels, dots join.
const JOIN_PX = 26
// A repeated name is left off within this distance.
const SAME_NAME_PX = 120

const mercatorY = (lat: number) => {
  const clamped = Math.max(-85, Math.min(85, lat))
  return (Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) * 180) / Math.PI
}

// The town a story's place names. Places are written from the spot outward ("Frauenstein castle,
// Wiesbaden, Germany"; "Glauberg, Wetterau, Germany"), so the town is the first part unless that part
// is a spot within it (a castle, a cave, a rock…), then the second.
const SPOT = /\(|\b(castle|cave|caves|rock|rocks|tower|church|chapel|abbey|monastery|convent|bridge|ruin|ruins|hill|mount|mountain|peak|spring|well|lake|forest|wood|stone|stones|gate|mill|square|valley|island|burgberg)\b/i

export function townOf(place: string) {
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
  const town = parts.length > 2 && SPOT.test(parts[0]) ? parts[1] : (parts[0] ?? '')
  return town.replace(/\s*\(.*?\)\s*/g, ' ').trim()
}

export function countryOf(place: string) {
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

// Longitudes on one side of the world: when the stories span more than half the globe, the western
// ones move east by 360°, so a Pacific spread stays together.
function unwrap(lngs: number[]) {
  const min = Math.min(...lngs)
  const max = Math.max(...lngs)
  if (max - min <= 180) return lngs
  const shifted = lngs.map((lng) => (lng < 0 ? lng + 360 : lng))
  return Math.max(...shifted) - Math.min(...shifted) < max - min ? shifted : lngs
}

export function layoutPlaces(
  stories: StoryPlace[],
  size: { width: number; height: number },
  // The area dots may use, as fractions of the banner: clear of the portrait's corner and with room for
  // names.
  area = { left: 0.3, right: 0.86, top: 0.2, bottom: 0.74 },
): MapDot[] {
  if (stories.length === 0 || size.width <= 0 || size.height <= 0) return []
  const lngs = unwrap(stories.map((s) => s.lng))
  const ys = stories.map((s) => mercatorY(s.lat))
  const lats = stories.map((s) => s.lat)

  const minX = Math.min(...lngs)
  const maxX = Math.max(...lngs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const wide = maxX - minX > WIDE_LNG || Math.max(...lats) - Math.min(...lats) > WIDE_LAT

  const box = {
    left: area.left * size.width,
    right: area.right * size.width,
    top: area.top * size.height,
    bottom: area.bottom * size.height,
  }
  const spanX = Math.max(maxX - minX, MIN_SPAN)
  const spanY = Math.max(maxY - minY, MIN_SPAN)
  // One scale for both directions, so the map isn't stretched; the stories are centred in the area.
  const scale = Math.min((box.right - box.left) / spanX, (box.bottom - box.top) / spanY)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const cx = (box.left + box.right) / 2
  const cy = (box.top + box.bottom) / 2

  const dots: MapDot[] = []
  stories.forEach((story, i) => {
    const x = cx + (lngs[i] - midX) * scale
    const y = cy - (ys[i] - midY) * scale
    const near = dots.find((d) => Math.hypot(d.x - x, d.y - y) < JOIN_PX)
    if (near) near.stories.push(story)
    else dots.push({ x, y, label: null, labelLeft: false, stories: [story] })
  })

  const shown: { x: number; y: number; name: string }[] = []
  for (const dot of dots) {
    // A dot is named by the one town (or, on a wide map, the one country) its stories share. Stories in
    // different towns that ended up on one dot are named by their country. No counts: a dot with several
    // stories opens them all on the Map tab (see `dotLink`).
    const names = [...new Set(dot.stories.map((s) => (wide ? countryOf(s.place) : townOf(s.place))))]
    const countries = [...new Set(dot.stories.map((s) => countryOf(s.place)))]
    const name = names.length === 1 ? names[0] : countries.length === 1 ? countries[0] : ''
    const repeated = shown.some((s) => s.name === name && Math.hypot(s.x - dot.x, s.y - dot.y) < SAME_NAME_PX)
    dot.label = name && !repeated ? name : null
    if (name) shown.push({ x: dot.x, y: dot.y, name })
    // Names near the right edge go on the dot's left.
    dot.labelLeft = dot.x > size.width * 0.72
  }
  return dots
}

// Where a dot leads: its story, or for several stories the Map tab framed around them, where each shows.
export function dotLink(dot: MapDot, storyPath: (story: StoryPlace) => string) {
  if (dot.stories.length === 1) return storyPath(dot.stories[0])
  const lat = dot.stories.reduce((sum, s) => sum + s.lat, 0) / dot.stories.length
  const lng = dot.stories.reduce((sum, s) => sum + s.lng, 0) / dot.stories.length
  const km = Math.max(...dot.stories.map((s) => Math.hypot(s.lat - lat, (s.lng - lng) * Math.cos((lat * Math.PI) / 180)) * 111))
  const params = new URLSearchParams({ lat: lat.toFixed(4), lng: lng.toFixed(4), r: String(Math.max(8, Math.ceil(km * 1.5))) })
  if (dot.label) params.set('label', dot.label)
  return `/map?${params}`
}
