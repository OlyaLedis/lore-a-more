// How far the map zooms in on a place, by what kind of place it is, so a country, a city, and a castle
// each fill the map sensibly. Used by map search, the clickable place line in story popups, and their
// cards. Zooms are Leaflet's (what the position strip shows).
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet'
import type { PlaceResult } from './geocoding'
import type { Precision } from './location'

type View = { bounds: LatLngBoundsExpression; maxZoom: number } | { center: [number, number]; zoom: number }

// Areas framed whole, up to this zoom.
const FRAMED: [types: string[], maxZoom: number][] = [
  [['continental_marine', 'country', 'major_landform'], 7],
  [['region'], 9],
  [['subregion', 'county', 'joint_municipality'], 11],
]
// Towns and villages: centred at Felt's zoom for a town (14). A big city (wider than this, in degrees
// of longitude) is framed instead, up to zoom 13, since 14 would show only a few of its streets.
const TOWN = ['municipality', 'municipal_district', 'joint_submunicipality', 'locality', 'place', 'postal_code']
const TOWN_ZOOM = 14
const BIG_CITY_SPAN = 0.2
const BIG_CITY_MAX_ZOOM = 13
// Smaller things: a neighbourhood, a specific place (castle, church, peak), a street or address.
const CLOSE: [types: string[], zoom: number][] = [
  [['neighbourhood'], 15],
  [['poi'], 16],
  [['road', 'address'], 17],
]

// `centre` is where to centre a town (its town centre, see placeCentre), else the place's own point.
export function placeView(place: PlaceResult, centre = { lat: place.lat, lng: place.lng }): View {
  const has = (types: string[]) => place.types.some((t) => types.includes(t))
  const framed = place.bbox ? FRAMED.find(([types]) => has(types)) : undefined
  if (framed && place.bbox) return { bounds: boundsOf(place.bbox), maxZoom: framed[1] }
  if (has(TOWN)) {
    if (place.bbox && place.bbox[2] - place.bbox[0] > BIG_CITY_SPAN) {
      return { bounds: boundsOf(place.bbox), maxZoom: BIG_CITY_MAX_ZOOM }
    }
    return { center: [centre.lat, centre.lng], zoom: TOWN_ZOOM }
  }
  const close = CLOSE.find(([types]) => has(types))
  return { center: [centre.lat, centre.lng], zoom: close ? close[1] : TOWN_ZOOM }
}

// A story's own spot: close in when it's an exact site, a little wider for an area or uncertain place.
export function storyZoom(precision: Precision | undefined) {
  return precision === 'exact' ? 16 : precision === 'uncertain' ? 13 : 14
}

export function flyToView(map: LeafletMap, view: View) {
  if ('bounds' in view) map.flyToBounds(view.bounds, { maxZoom: view.maxZoom, padding: [24, 24], duration: 0.8 })
  else map.flyTo(view.center, view.zoom, { duration: 0.8 })
}

function boundsOf([west, south, east, north]: [number, number, number, number]): LatLngBoundsExpression {
  return [
    [south, west],
    [north, east],
  ]
}
