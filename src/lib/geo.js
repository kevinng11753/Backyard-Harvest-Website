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
