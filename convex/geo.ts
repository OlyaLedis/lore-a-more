// Distance helpers shared by server functions and the frontend.

export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// "Near you" on Home and in Top Picks.
export const NEARBY_KM = 50;

// How close a reader must be to count as being at a story's place. A town or an uncertain place
// covers more ground than an exact site.
export function atPlaceKm(precision: "exact" | "area" | "uncertain" | undefined) {
  return precision === "exact" ? 2 : precision === "area" ? 10 : 25;
}

export function isValidLatLng({ lat, lng }: LatLng) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
