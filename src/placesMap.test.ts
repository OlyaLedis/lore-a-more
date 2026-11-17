import { describe, expect, test } from 'vitest'
import { countryOf, dotLink, layoutPlaces, townOf, type StoryPlace } from './placesMap'

const at = (place: string, lat: number, lng: number, n = 0): StoryPlace => ({ _id: `${place}${n}`, title: place, lat, lng, place })
const size = { width: 1000, height: 210 }
const area = { left: 0.3, right: 0.86, top: 0.2, bottom: 0.74 }

describe('townOf and countryOf', () => {
  test('the town, skipping a spot within it', () => {
    expect(townOf('Lorch am Rhein, at the mouth of the Wisper, Germany')).toBe('Lorch am Rhein')
    expect(townOf('Burgberg (the “Nadelkissen”), Bad Soden am Taunus, Germany')).toBe('Bad Soden am Taunus')
    expect(townOf('Glauberg, Wetterau, Germany')).toBe('Glauberg')
    expect(townOf('Frauenstein castle, Wiesbaden, Germany')).toBe('Wiesbaden')
    expect(townOf('Is Janas cave, Sadali, Sardinia, Italy')).toBe('Sadali')
    expect(countryOf('Is Janas cave, Sadali, Sardinia, Italy')).toBe('Italy')
  })
})

describe('layoutPlaces', () => {
  const inArea = (x: number, y: number) =>
    x >= area.left * size.width - 0.5 && x <= area.right * size.width + 0.5 && y >= area.top * size.height - 0.5 && y <= area.bottom * size.height + 0.5

  test('nearby stories fill the area, named by town, west to east', () => {
    const dots = layoutPlaces(
      [
        at('Lorch am Rhein, at the mouth of the Wisper, Germany', 50.0441, 7.8038),
        at('Burgberg (the “Nadelkissen”), Bad Soden am Taunus, Germany', 50.1467, 8.5027),
        at('Glauberg, Wetterau, Germany', 50.3083, 9.0083),
      ],
      size,
    )
    expect(dots.map((d) => d.label)).toEqual(['Lorch am Rhein', 'Bad Soden am Taunus', 'Glauberg'])
    expect(dots.every((d) => inArea(d.x, d.y))).toBe(true)
    expect(dots[0].x).toBeLessThan(dots[1].x)
    expect(dots[2].y).toBeLessThan(dots[0].y) // further north is higher
  })

  test('stories on several continents are named by country', () => {
    const dots = layoutPlaces(
      [at('Hamelin, Lower Saxony, Germany', 52.1, 9.37), at('Is Janas cave, Sadali, Sardinia, Italy', 39.81, 9.27), at('Nara, Japan', 34.68, 135.8)],
      size,
    )
    expect(dots.map((d) => d.label)).toEqual(['Germany', 'Italy', 'Japan'])
    expect(dots.every((d) => inArea(d.x, d.y))).toBe(true)
  })

  test('across the Pacific, the short way round', () => {
    const dots = layoutPlaces([at('Nara, Japan', 34.68, 135.8), at('Monterey, California, United States', 36.6, -121.9)], size)
    // Japan west of California, not at opposite ends of the world map.
    expect(dots[0].x).toBeLessThan(dots[1].x)
  })

  test('stories in the same place become one dot, named without a count, opening them on the map', () => {
    const dots = layoutPlaces([at('Glauberg, Wetterau, Germany', 50.3083, 9.0083, 1), at('Glauberg, Wetterau, Germany', 50.3084, 9.0084, 2)], size)
    expect(dots).toHaveLength(1)
    expect(dots[0].label).toBe('Glauberg')
    expect(dotLink(dots[0], () => '/story')).toMatch(/^\/map\?lat=50\.308\d&lng=9\.008\d&r=8&label=Glauberg$/)
  })

  test('a dot with one story opens that story', () => {
    const [dot] = layoutPlaces([at('Glauberg, Wetterau, Germany', 50.3, 9.0)], size)
    expect(dotLink(dot, (s) => `/story/${s.title}`)).toBe('/story/Glauberg, Wetterau, Germany')
  })

  test('stories in different towns on one dot are named by their country', () => {
    const dots = layoutPlaces([at('Lorch am Rhein, Germany', 50.0441, 7.8038), at('Assmannshausen, Germany', 50.0442, 7.8039)], size)
    expect(dots.map((d) => d.label)).toEqual(['Germany'])
  })

  test('one story sits in the middle of the area; none draws nothing', () => {
    const [dot] = layoutPlaces([at('Glauberg, Wetterau, Germany', 50.3, 9.0)], size)
    expect(dot.x).toBeCloseTo(((area.left + area.right) / 2) * size.width)
    expect(layoutPlaces([], size)).toEqual([])
  })
})
