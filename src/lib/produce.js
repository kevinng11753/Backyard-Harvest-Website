// Categories, freshness math, and small text helpers shared by many screens.

export const CATEGORIES = [
  { id: 'vegetables', label: 'Vegetables', emoji: '🥕' },
  { id: 'fruit', label: 'Fruit', emoji: '🍑' },
  { id: 'greens', label: 'Greens', emoji: '🥬' },
  { id: 'herbs', label: 'Herbs', emoji: '🌿' },
  { id: 'flowers', label: 'Flowers', emoji: '🌻' },
  { id: 'seedlings', label: 'Seedlings', emoji: '🌱' }
]

export function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

// How long until a listing disappears. The poster picks one of these.
export const SHELF_LIFE_OPTIONS = [
  { days: 1, label: 'Today' },
  { days: 2, label: '2 days' },
  { days: 4, label: '4 days' },
  { days: 7, label: 'A week' }
]

const DAY = 24 * 60 * 60 * 1000

// Returns how fresh a listing is, for the ring around each photo:
//   fraction: 1 = just posted, 0 = expired
//   level:    'fresh' | 'soon' | 'last'  (picks the ring color)
//   label:    short text like "3 days left"
export function freshness(listing, now = Date.now()) {
  const start = new Date(listing.created_at).getTime()
  const end = new Date(listing.expires_at).getTime()
  const left = end - now
  const fraction = Math.max(0, Math.min(1, left / Math.max(end - start, 1)))

  let label
  if (left <= 0) label = 'Expired'
  else if (left < 12 * 60 * 60 * 1000) label = 'Last few hours'
  else if (left < 1.5 * DAY) label = 'Ends tomorrow'
  else label = `${Math.round(left / DAY)} days left`

  const level = fraction > 0.5 ? 'fresh' : fraction > 0.2 ? 'soon' : 'last'
  return { fraction, level, label, expired: left <= 0 }
}

export function isActive(listing, now = Date.now()) {
  return listing.status === 'available' && new Date(listing.expires_at).getTime() > now
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || 'A neighbor'
}

export function timeAgo(iso, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
