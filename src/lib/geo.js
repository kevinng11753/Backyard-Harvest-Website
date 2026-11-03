// Location helpers.

// Used only when the browser can't tell us where the person is
// (they said no, or the device has no GPS). Change it to your town.
export const FALLBACK_CENTER = { lat: 38.8899, lng: -77.0091 }

// Ask the browser for the person's location. Resolves with
// { lat, lng, precise: true } or the fallback with precise: false.
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ...FALLBACK_CENTER, precise: false })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precise: true }),
      () => resolve({ ...FALLBACK_CENTER, precise: false }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

// Privacy: move a point randomly by up to ~200 m, then round it.
// This is what gets saved and shown on the public map, so nobody can
// find a grower's exact house from a listing.
export function blurLocation({ lat, lng }) {
  const maxMeters = 200
  const distance = maxMeters * Math.sqrt(Math.random())
  const angle = Math.random() * 2 * Math.PI
  const dLat = (distance * Math.cos(angle)) / 111_320
  const dLng = (distance * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    lat: Math.round((lat + dLat) * 1000) / 1000,
    lng: Math.round((lng + dLng) * 1000) / 1000
  }
}

// How far "nearby" reaches. Listings farther than this aren't shown.
export const NEARBY_RADIUS_MILES = 10

// A square used to ask the database for only the listings that could be in
// range (so it never has to send the whole world). The exact circle is applied
// afterwards, on the device, with distanceMiles().
//
// Privacy: this square is sent over the network, so it is NOT centred on the
// person's exact position. It's centred on the nearest point of a coarse grid
// (about 3.5 miles apart) and made a little bigger, so it still covers the
// whole circle around where they really are, while the real spot stays on
// their device.
const PRIVACY_GRID_DEGREES = 0.05

const snap = (degrees) => Math.round(degrees / PRIVACY_GRID_DEGREES) * PRIVACY_GRID_DEGREES
// Round the edges outward (never inward), so rounding can't clip the box.
const down = (degrees) => Math.floor(degrees * 1000) / 1000
const up = (degrees) => Math.ceil(degrees * 1000) / 1000

export function boundingBox({ lat, lng }, miles = NEARBY_RADIUS_MILES) {
  const centerLat = snap(lat)
  const centerLng = snap(lng)
  const pad = PRIVACY_GRID_DEGREES / 2 // the real position is within this of the rounded one
  const latReach = miles / 69 + pad // about 69 miles per degree of latitude
  // A degree of longitude is shorter towards the poles, so size the box using
  // the highest latitude it reaches.
  const highestLat = Math.min(Math.abs(centerLat) + latReach, 89)
  const lngReach = miles / (69 * Math.max(Math.cos((highestLat * Math.PI) / 180), 0.01)) + pad
  return {
    minLat: down(centerLat - latReach),
    maxLat: up(centerLat + latReach),
    minLng: down(centerLng - lngReach),
    maxLng: up(centerLng + lngReach)
  }
}

// Straight-line distance between two points in miles (haversine formula).
export function distanceMiles(a, b) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(miles) {
  if (miles < 0.1) return 'Right nearby'
  if (miles < 10) return `${miles.toFixed(1)} mi away`
  return `${Math.round(miles)} mi away`
}
