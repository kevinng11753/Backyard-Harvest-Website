// Demo mode: the same functions as supabaseApi.js, but everything is
// saved in this browser's localStorage. It lets you (and judges) try
// the whole app before Supabase is connected. Nothing leaves the device.
import { compressImage, blobToDataUrl } from './image.js'
import { getCurrentPosition, blurLocation, distanceMiles, NEARBY_RADIUS_MILES } from './geo.js'

const KEY = 'backyard-harvest-demo-v1'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// In demo mode, a neighbor "answers" your request after this long,
// so you can see the whole pickup flow on your own.
const AUTO_ACCEPT_AFTER = 6000

const id = () => crypto.randomUUID()
const iso = (ms) => new Date(ms).toISOString()
const clone = (x) => JSON.parse(JSON.stringify(x))

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved) return saved
  } catch {
    // Storage is blocked or the data is damaged — start fresh.
  }
  return { users: [], sessionUserId: null, listings: [], pickups: {}, requests: [], blocks: [], reports: [], seeded: false }
}

function save(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Storage full or blocked; the demo keeps working until refresh.
  }
}

let db = load()
// Demo data saved before blocks and reports existed won't have these lists.
db.blocks ??= []
db.reports ??= []
const listeners = new Set()
const notify = (event) => listeners.forEach((fn) => fn(event))
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// ---------- Sample neighborhood ----------
const NEIGHBORS = [
  { display_name: 'Jorge Alvarez', neighborhood: 'Linden Street' },
  { display_name: 'Priya Natarajan', neighborhood: 'Oak Hollow' },
  { display_name: 'Dot Whitfield', neighborhood: 'Linden Street' },
  { display_name: 'Sam Okafor', neighborhood: 'Mill Creek' },
  { display_name: 'Maya Chen', neighborhood: 'Oak Hollow' }
]

const SAMPLE_LISTINGS = [
  { owner: 0, title: 'Cherry tomatoes', category: 'vegetables', quantity: 'A full colander', description: 'Sungolds and a few reds. Picked this morning, a little split but sweet.', ageH: 20, lifeD: 4, offset: [0.004, 0.003] },
  { owner: 1, title: 'Zucchini', category: 'vegetables', quantity: '5 big ones', description: 'The plants won’t stop. Great for bread or grilling.', ageH: 30, lifeD: 7, offset: [-0.006, 0.005] },
  { owner: 2, title: 'Genovese basil', category: 'herbs', quantity: '2 big bunches', description: 'Cut fresh when you pick up. Bring a jar of water if you can.', ageH: 21, lifeD: 1, offset: [0.002, -0.006] },
  { owner: 3, title: 'Brown Turkey figs', category: 'fruit', quantity: 'About 2 lbs', description: 'Very ripe. Best eaten within a day or two.', ageH: 6, lifeD: 2, offset: [0.009, -0.002] },
  { owner: 1, title: 'Lacinato kale', category: 'greens', quantity: 'Grocery bag', description: 'No pesticides. Rinse well — garden bugs like it too.', ageH: 50, lifeD: 4, offset: [-0.003, -0.004] },
  { owner: 2, title: 'Sunflower heads', category: 'flowers', quantity: '6 stems', description: 'Bright yellow, long stems for a vase.', ageH: 3, lifeD: 4, offset: [0.001, 0.007] },
  { owner: 3, title: 'Pepper seedlings', category: 'seedlings', quantity: '8 pots', description: 'Extra jalapeño and bell starts for a fall pot.', ageH: 70, lifeD: 7, offset: [-0.008, -0.007] }
]

async function seedIfNeeded() {
  if (db.seeded) return
  const center = await getCurrentPosition()
  const now = Date.now()

  const neighborIds = NEIGHBORS.map((n) => {
    const user = { id: id(), email: null, password: null, ...n, sample: true }
    db.users.push(user)
    return user.id
  })

  for (const s of SAMPLE_LISTINGS) {
    const listing = {
      id: id(),
      owner_id: neighborIds[s.owner],
      title: s.title,
      category: s.category,
      quantity: s.quantity,
      description: s.description,
      photo_url: null,
      ...toApprox(blurLocation({ lat: center.lat + s.offset[0], lng: center.lng + s.offset[1] })),
      created_at: iso(now - s.ageH * HOUR),
      expires_at: iso(now - s.ageH * HOUR + s.lifeD * DAY),
      status: 'available'
    }
    db.listings.push(listing)
    db.pickups[listing.id] = {
      listing_id: listing.id,
      address: `${100 + Math.floor(Math.random() * 800)} ${NEIGHBORS[s.owner].neighborhood}`,
      instructions: 'On the bench by the front steps. Ring the bell if it’s not there.'
    }
  }
  db.seeded = true
  db.neighborIds = neighborIds
  save(db)
}

// Give a brand-new demo user one listing that already has a request,
// so they can try accepting right away.
async function seedForNewUser(user) {
  const center = await getCurrentPosition()
  const now = Date.now()
  const listing = {
    id: id(),
    owner_id: user.id,
    title: 'Mint cuttings',
    category: 'herbs',
    quantity: '10 sprigs',
    description: 'Roots easily in a glass of water. Takes over any bed, so maybe use a pot.',
    photo_url: null,
    ...toApprox(blurLocation(center)),
    created_at: iso(now - 2 * HOUR),
    expires_at: iso(now - 2 * HOUR + 4 * DAY),
    status: 'available'
  }
  db.listings.push(listing)
  db.pickups[listing.id] = { listing_id: listing.id, address: 'Your front porch', instructions: 'In a cup by the door.' }
  db.requests.push({
    id: id(),
    listing_id: listing.id,
    requester_id: db.neighborIds[4],
    message: 'I’d love some for iced tea! I can come by after school.',
    status: 'pending',
    created_at: iso(now - 40 * 60 * 1000)
  })
}

const toApprox = ({ lat, lng }) => ({ approx_lat: lat, approx_lng: lng })
const profileOf = (userId) => {
  const u = db.users.find((x) => x.id === userId)
  return u ? { display_name: u.display_name, neighborhood: u.neighborhood } : { display_name: 'Neighbor', neighborhood: null }
}
const me = () => db.users.find((u) => u.id === db.sessionUserId) ?? null

// Is there a block between these two people, in either direction?
const blockedBetween = (a, b) =>
  !!a && !!b && db.blocks.some((x) => (x.blocker_id === a && x.blocked_id === b) || (x.blocker_id === b && x.blocked_id === a))

function requireUser() {
  const user = me()
  if (!user) throw new Error('Please sign in again.')
  return user
}

// Pretend sample neighbors answer requests after a few seconds.
function autoAnswerRequests() {
  const now = Date.now()
  let changed = false
  for (const r of db.requests) {
    if (r.status !== 'pending') continue
    const listing = db.listings.find((l) => l.id === r.listing_id)
    const owner = db.users.find((u) => u.id === listing?.owner_id)
    if (owner?.sample && now - new Date(r.created_at).getTime() > AUTO_ACCEPT_AFTER) {
      acceptRequest(r.id)
      changed = true
    }
  }
  if (changed) save(db)
}

function acceptRequest(requestId) {
  const r = db.requests.find((x) => x.id === requestId)
  r.status = 'accepted'
  const listing = db.listings.find((l) => l.id === r.listing_id)
  listing.status = 'claimed'
  for (const other of db.requests) {
    if (other.listing_id === r.listing_id && other.id !== r.id && other.status === 'pending') {
      other.status = 'declined'
      other.auto_declined = true // so they can come back if this neighbor cancels
    }
  }
}

export function createDemoApi() {
  return {
    mode: 'demo',

    // ---------- Accounts ----------
    async getUser() {
      const user = me()
      return user ? { id: user.id, email: user.email, display_name: user.display_name, neighborhood: user.neighborhood } : null
    },

    onAuthChange(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    async signUp({ email, password, displayName, neighborhood }) {
      await wait()
      await seedIfNeeded()
      const clean = email.trim().toLowerCase()
      if (db.users.some((u) => u.email === clean)) throw new Error('That email already has an account. Sign in instead.')
      if (password.length < 6) throw new Error('Use a password with at least 6 characters.')
      const user = { id: id(), email: clean, password, display_name: displayName.trim() || 'Neighbor', neighborhood: neighborhood.trim() }
      db.users.push(user)
      await seedForNewUser(user)
      db.sessionUserId = user.id
      save(db)
      notify()
      return { needsConfirmation: false }
    },

    async signIn({ email, password }) {
      await wait()
      const user = db.users.find((u) => u.email === email.trim().toLowerCase())
      if (!user || user.password !== password) throw new Error('That email and password don’t match.')
      db.sessionUserId = user.id
      save(db)
      notify()
    },

    async signOut() {
      db.sessionUserId = null
      save(db)
      notify()
    },

    // Demo mode can't send email, so the "link" opens straight away, the way
    // following it from an inbox would. Unknown addresses do nothing, same
    // as the real thing.
    async requestPasswordReset(email) {
      await wait()
      const user = db.users.find((u) => u.email === email.trim().toLowerCase())
      if (user) {
        db.sessionUserId = user.id
        save(db)
        notify('PASSWORD_RECOVERY')
      }
    },

    async updatePassword(password) {
      const user = requireUser()
      await wait()
      if (password.length < 6) throw new Error('Use a password with at least 6 characters.')
      user.password = password
      save(db)
      notify('USER_UPDATED')
    },

    // Same as the real thing: check the password, then remove the account and
    // everything tied to it (listings, their pickup details, and requests
    // made by the person or on their listings).
    async deleteAccount(password) {
      const user = requireUser()
      await wait()
      if (user.password !== password) throw new Error('That password doesn’t match.')
      const mine = new Set(db.listings.filter((l) => l.owner_id === user.id).map((l) => l.id))
      db.listings = db.listings.filter((l) => !mine.has(l.id))
      mine.forEach((listingId) => delete db.pickups[listingId])
      db.requests = db.requests.filter((r) => r.requester_id !== user.id && !mine.has(r.listing_id))
      db.blocks = db.blocks.filter((b) => b.blocker_id !== user.id && b.blocked_id !== user.id)
      db.reports = db.reports.filter((r) => r.reporter_id !== user.id && r.reported_user_id !== user.id)
      db.users = db.users.filter((u) => u.id !== user.id)
      db.sessionUserId = null
      save(db)
      notify()
    },

    // ---------- Browsing ----------
    async listActive(location, radiusMiles = NEARBY_RADIUS_MILES) {
      await wait(150)
      await seedIfNeeded()
      autoAnswerRequests()
      const now = Date.now()
      return clone(
        db.listings
          .filter((l) => l.status === 'available' && new Date(l.expires_at).getTime() > now)
          .filter((l) => !location || distanceMiles(location, { lat: l.approx_lat, lng: l.approx_lng }) <= radiusMiles)
          .filter((l) => !blockedBetween(db.sessionUserId, l.owner_id)) // blocked either way: out of sight
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((l) => ({ ...l, owner: profileOf(l.owner_id) }))
      )
    },

    // The signed-out home page: open listings, first names only, no owner ids.
    async listPublic() {
      await wait(150)
      await seedIfNeeded()
      autoAnswerRequests()
      const now = Date.now()
      return clone(
        db.listings
          .filter((l) => l.status === 'available' && new Date(l.expires_at).getTime() > now)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(({ owner_id, ...l }) => ({
            ...l,
            owner: { display_name: profileOf(owner_id).display_name.split(' ')[0] }
          }))
      )
    },

    // ---------- Your listings ----------
    async myListings() {
      const user = requireUser()
      autoAnswerRequests()
      return clone(
        db.listings
          .filter((l) => l.owner_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((l) => ({
            ...l,
            requests: db.requests
              .filter((r) => r.listing_id === l.id)
              .map((r) => ({ ...r, requester: profileOf(r.requester_id) }))
          }))
      )
    },

    async createListing({ photoFile, pickup, ...fields }) {
      const user = requireUser()
      let photo_url = null
      if (photoFile) photo_url = await blobToDataUrl(await compressImage(photoFile, 800, 0.72))
      const listing = {
        id: id(),
        owner_id: user.id,
        ...fields,
        photo_url,
        status: 'available',
        created_at: iso(Date.now())
      }
      db.listings.push(listing)
      db.pickups[listing.id] = { listing_id: listing.id, ...pickup }
      save(db)
      return clone(listing)
    },

    async setListingStatus(listingId, status) {
      const user = requireUser()
      const listing = db.listings.find((l) => l.id === listingId && l.owner_id === user.id)
      if (!listing) throw new Error('Only the grower can change this listing.')
      listing.status = status
      save(db)
    },

    async getMyPickup(listingId) {
      const user = requireUser()
      const listing = db.listings.find((l) => l.id === listingId && l.owner_id === user.id)
      if (!listing) throw new Error('You can only edit your own listings.')
      const p = db.pickups[listingId]
      return p ? { address: p.address, instructions: p.instructions ?? null } : null
    },

    async updateListing(listingId, { pickup, ...fields }) {
      const user = requireUser()
      const listing = db.listings.find((l) => l.id === listingId && l.owner_id === user.id)
      if (!listing) throw new Error('You can only edit your own listings.')
      Object.assign(listing, fields)
      db.pickups[listingId] = { listing_id: listingId, ...pickup }
      save(db)
    },

    async deleteListing(listingId) {
      const user = requireUser()
      const listing = db.listings.find((l) => l.id === listingId && l.owner_id === user.id)
      if (!listing) throw new Error('You can only delete your own listings.')
      db.listings = db.listings.filter((l) => l.id !== listingId)
      db.requests = db.requests.filter((r) => r.listing_id !== listingId)
      delete db.pickups[listingId]
      save(db)
    },

    // ---------- Requests ----------
    async myRequests() {
      const user = requireUser()
      autoAnswerRequests()
      return clone(
        db.requests
          .filter((r) => r.requester_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((r) => {
            const listing = db.listings.find((l) => l.id === r.listing_id)
            return {
              ...r,
              // Like the real database, a listing from someone you blocked (or who blocked you) is hidden.
              listing: listing && !blockedBetween(user.id, listing.owner_id) ? { ...listing, owner: profileOf(listing.owner_id) } : null,
              // Same privacy rule as the real database: address only after acceptance.
              pickup: r.status === 'accepted' ? db.pickups[r.listing_id] ?? null : null
            }
          })
      )
    },

    async requestListing(listingId, message) {
      const user = requireUser()
      await wait()
      const listing = db.listings.find((l) => l.id === listingId)
      if (!listing || listing.status !== 'available' || new Date(listing.expires_at) <= new Date() || blockedBetween(user.id, listing.owner_id))
        throw new Error('This one was just claimed or has expired.')
      if (listing.owner_id === user.id) throw new Error('That’s your own listing.')
      if (db.requests.some((r) => r.listing_id === listingId && r.requester_id === user.id))
        throw new Error('You already asked for this one.')
      const open = db.requests.filter((r) => r.requester_id === user.id && r.status === 'pending').length
      if (open >= 3) throw new Error('You have 3 open requests. Wait for an answer or cancel one first.')
      db.requests.push({ id: id(), listing_id: listingId, requester_id: user.id, message: message || null, status: 'pending', created_at: iso(Date.now()) })
      save(db)
    },

    async respond(requestId, decision) {
      const user = requireUser()
      const r = db.requests.find((x) => x.id === requestId)
      const listing = db.listings.find((l) => l.id === r?.listing_id)
      if (!r || r.status !== 'pending') throw new Error('That request is no longer open.')
      if (listing?.owner_id !== user.id) throw new Error('Only the grower can answer this request.')
      if (decision === 'accepted') acceptRequest(requestId)
      else r.status = 'declined'
      save(db)
    },

    async cancelRequest(requestId) {
      const user = requireUser()
      const r = db.requests.find((x) => x.id === requestId && x.requester_id === user.id)
      if (!r) throw new Error('That request was not found.')
      if (r.status !== 'pending' && r.status !== 'accepted') throw new Error('That request is already closed.')
      const wasAccepted = r.status === 'accepted'
      r.status = 'cancelled'
      if (wasAccepted) reopenListing(r.listing_id)
      save(db)
    },

    // ---------- Report and block ----------
    async reportListing(listingId, reason, note) {
      const user = requireUser()
      await wait()
      const listing = db.listings.find((l) => l.id === listingId)
      if (!listing || listing.owner_id === user.id || blockedBetween(user.id, listing.owner_id)) throw new Error('That listing was not found.')
      addReport(user, { listing, reason, note, content: listing.description })
    },

    async reportRequest(requestId, reason, note) {
      const user = requireUser()
      await wait()
      const request = db.requests.find((r) => r.id === requestId)
      const listing = db.listings.find((l) => l.id === request?.listing_id)
      if (!request || listing?.owner_id !== user.id) throw new Error('That request was not found.')
      addReport(user, { listing, request, reason, note, content: request.message })
    },

    // Blocking ends open requests between the two people, like the real thing.
    async blockUser(userId) {
      const user = requireUser()
      await wait()
      if (!userId || userId === user.id) throw new Error('You can’t block yourself.')
      if (!db.users.some((u) => u.id === userId)) throw new Error('That person was not found.')
      if (!db.blocks.some((b) => b.blocker_id === user.id && b.blocked_id === userId)) {
        db.blocks.push({ blocker_id: user.id, blocked_id: userId, created_at: iso(Date.now()) })
      }

      // Requests I made on their listings: cancelled (and reopened if I'd been accepted).
      const theirs = new Set(db.listings.filter((l) => l.owner_id === userId).map((l) => l.id))
      for (const r of db.requests) {
        if (r.requester_id === user.id && theirs.has(r.listing_id) && (r.status === 'pending' || r.status === 'accepted')) {
          const wasAccepted = r.status === 'accepted'
          r.status = 'cancelled'
          if (wasAccepted) reopenListing(r.listing_id)
        }
      }

      // Requests they made on my listings: declined, and a listing they'd been accepted for opens up again.
      const mine = new Set(db.listings.filter((l) => l.owner_id === user.id).map((l) => l.id))
      const freed = []
      for (const r of db.requests) {
        if (r.requester_id !== userId || !mine.has(r.listing_id)) continue
        if (r.status === 'accepted') freed.push(r.listing_id)
        if (r.status === 'pending' || r.status === 'accepted' || r.auto_declined) {
          r.status = 'declined'
          r.auto_declined = false
        }
      }
      freed.forEach(reopenListing)
      save(db)
    },

    async myBlocks() {
      const user = requireUser()
      return clone(
        db.blocks
          .filter((b) => b.blocker_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((b) => ({ ...b, blocked: profileOf(b.blocked_id) }))
      )
    },

    async unblockUser(userId) {
      const user = requireUser()
      const before = db.blocks.length
      db.blocks = db.blocks.filter((b) => !(b.blocker_id === user.id && b.blocked_id === userId))
      if (db.blocks.length === before) throw new Error('That block was not found.')
      save(db)
    }
  }
}

// Put a listing back on offer (unless the grower marked it gone), and bring
// back requests that were declined only because another one was accepted.
function reopenListing(listingId) {
  const listing = db.listings.find((l) => l.id === listingId)
  if (listing?.status === 'claimed') listing.status = 'available'
  for (const other of db.requests) {
    if (other.listing_id === listingId && other.status === 'declined' && other.auto_declined) {
      other.status = 'pending'
      other.auto_declined = false
    }
  }
}

// Reports are only stored in demo mode; there is no one to read them.
function addReport(reporter, { listing, request, reason, note, content }) {
  const duplicate = db.reports.some(
    (r) => r.reporter_id === reporter.id && (request ? r.request_id === request.id : !r.request_id && r.listing_id === listing.id)
  )
  if (duplicate) throw new Error('You already reported this.')
  const today = db.reports.filter((r) => r.reporter_id === reporter.id && Date.now() - new Date(r.created_at).getTime() < DAY)
  if (today.length >= 10) throw new Error('You’ve sent several reports today. Please try again tomorrow.')
  db.reports.push({
    id: id(),
    reporter_id: reporter.id,
    reported_user_id: request ? request.requester_id : listing.owner_id,
    listing_id: listing.id,
    request_id: request?.id ?? null,
    reason,
    note: note?.trim() || null,
    content: content ?? null,
    created_at: iso(Date.now())
  })
  save(db)
}

// Wipes demo data (used by the "Reset demo" button).
export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  db = load()
  notify()
}
