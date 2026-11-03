// The live backend: every function here talks to Supabase.
// demoApi.js has the same functions, so the screens never need to
// know which one they're using.
import { createClient } from '@supabase/supabase-js'
import { compressImage } from './image.js'
import { boundingBox, NEARBY_RADIUS_MILES } from './geo.js'

export function createSupabaseApi(url, anonKey) {
  const supabase = createClient(url, anonKey)

  // Supabase returns { data, error }. This throws the error instead,
  // so screens can use a simple try/catch.
  function check({ data, error }) {
    if (error) throw new Error(friendlyError(error.message))
    return data
  }

  async function currentUserId() {
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user?.id
    if (!id) throw new Error('Please sign in again.')
    return id
  }

  return {
    mode: 'live',

    // ---------- Accounts ----------
    async getUser() {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const profile = check(
        await supabase.from('profiles').select('display_name, neighborhood').eq('id', user.id).maybeSingle()
      )
      return { id: user.id, email: user.email, ...(profile ?? { display_name: 'Neighbor' }) }
    },

    onAuthChange(callback) {
      // The event name is passed along so the app can notice PASSWORD_RECOVERY.
      const { data } = supabase.auth.onAuthStateChange((event) => callback(event))
      return () => data.subscription.unsubscribe()
    },

    async signUp({ email, password, displayName, neighborhood }) {
      const data = check(
        await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName, neighborhood } }
        })
      )
      // If "Confirm email" is on in Supabase, there's no session until
      // the person clicks the link in their inbox.
      return { needsConfirmation: !data.session }
    },

    async signIn({ email, password }) {
      check(await supabase.auth.signInWithPassword({ email, password }))
    },

    async signOut() {
      await supabase.auth.signOut()
    },

    // Emails a reset link. The result is the same whether or not the address
    // has an account, so this can't be used to find out who has signed up.
    async requestPasswordReset(email) {
      check(await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }))
    },

    // For the "choose a new password" screen, reached by following that email.
    async updatePassword(password) {
      check(await supabase.auth.updateUser({ password }))
    },

    // Permanently deletes the signed-in person's account and everything tied to
    // it. The password is checked again first, so a stranger at an unattended,
    // signed-in device can't do this. Photo files go first because they don't
    // disappear with the account; then one database call removes the account,
    // and with it the profile, listings, pickup details and requests.
    async deleteAccount(password) {
      const uid = await currentUserId()
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password })
      if (passwordError) throw new Error('That password doesn’t match.')

      await removeAllPhotosOf(supabase, uid)
      check(await supabase.rpc('delete_my_account'))
      // The account no longer exists on the server, so only clear this device.
      await supabase.auth.signOut({ scope: 'local' })
    },

    // ---------- Browsing ----------
    // Only listings inside a box around `location`, so far-away listings can
    // never crowd nearby ones out of the 200-row limit.
    async listActive(location, radiusMiles = NEARBY_RADIUS_MILES) {
      const box = boundingBox(location, radiusMiles)
      return check(
        await supabase
          .from('listings')
          .select('*, owner:profiles(display_name, neighborhood)')
          .eq('status', 'available')
          .gt('expires_at', new Date().toISOString()) // auto-expire: old listings simply stop showing
          .gte('approx_lat', box.minLat)
          .lte('approx_lat', box.maxLat)
          .gte('approx_lng', box.minLng)
          .lte('approx_lng', box.maxLng)
          .order('created_at', { ascending: false })
          .limit(200)
      )
    },

    // The signed-out home page. Works without an account: a database function
    // hands back open listings with only the grower's first name and a
    // coarse area, never the pickup address.
    async listPublic() {
      return check(await supabase.rpc('public_listings')) ?? []
    },

    // Counts of accepted shares per category: for the whole neighborhood, and
    // (when signed in) the ones you gave and received. Open to signed-out visitors.
    async impactStats() {
      return check(await supabase.rpc('impact_stats'))
    },

    // ---------- Your listings ----------
    async myListings() {
      const uid = await currentUserId()
      return check(
        await supabase
          .from('listings')
          .select('*, requests(*, requester:profiles(display_name, neighborhood))')
          .eq('owner_id', uid)
          .order('created_at', { ascending: false })
      )
    },

    async createListing({ photoFile, pickup, ...fields }) {
      const uid = await currentUserId()

      let photo_url = null
      let photoPath = null
      if (photoFile) {
        const blob = await compressImage(photoFile)
        photoPath = `${uid}/${crypto.randomUUID()}.jpg`
        check(await supabase.storage.from('produce-photos').upload(photoPath, blob, { contentType: 'image/jpeg' }))
        photo_url = supabase.storage.from('produce-photos').getPublicUrl(photoPath).data.publicUrl
      }

      try {
        // One database call saves the listing AND its private pickup details
        // together, so a failure can never leave a listing without an address.
        const id = check(
          await supabase.rpc('create_listing', {
            p_title: fields.title,
            p_category: fields.category,
            p_quantity: fields.quantity,
            p_description: fields.description,
            p_photo_url: photo_url,
            p_approx_lat: fields.approx_lat,
            p_approx_lng: fields.approx_lng,
            p_expires_at: fields.expires_at,
            p_address: pickup.address,
            p_instructions: pickup.instructions
          })
        )
        return { id }
      } catch (err) {
        // The listing wasn't saved, so don't leave its photo behind.
        if (photoPath) await supabase.storage.from('produce-photos').remove([photoPath]).catch(() => {})
        throw err
      }
    },

    async setListingStatus(listingId, status) {
      check(await supabase.from('listings').update({ status }).eq('id', listingId))
    },

    // The grower's own private pickup details, to fill in the edit form.
    async getMyPickup(listingId) {
      return check(
        await supabase.from('listing_pickups').select('address, instructions').eq('listing_id', listingId).maybeSingle()
      )
    },

    // Edit a listing you posted. Pickup details go first, so if that fails
    // nothing else has changed. A write that the database refuses can come
    // back with no error and no rows, so that's treated as a failure too.
    async updateListing(listingId, { pickup, ...fields }) {
      const pickupRows = check(
        await supabase.from('listing_pickups').update(pickup).eq('listing_id', listingId).select('listing_id')
      )
      if (!pickupRows?.length) throw new Error('You can only edit your own listings.')
      const rows = check(await supabase.from('listings').update(fields).eq('id', listingId).select('id'))
      if (!rows?.length) throw new Error('You can only edit your own listings.')
    },

    // Delete a listing you posted. Its pickup details and any requests for
    // it go with it. The photo is tidied up too, so storage doesn't fill
    // with files nobody can see.
    async deleteListing(listingId, photoUrl) {
      const rows = check(await supabase.from('listings').delete().eq('id', listingId).select('id'))
      if (!rows?.length) throw new Error('You can only delete your own listings.')
      const path = photoPathFromUrl(photoUrl)
      if (path) await supabase.storage.from('produce-photos').remove([path]).catch(() => {})
    },

    // ---------- Requests ----------
    async myRequests() {
      const uid = await currentUserId()
      const requests = check(
        await supabase
          .from('requests')
          .select('*, listing:listings(*, owner:profiles(display_name, neighborhood))')
          .eq('requester_id', uid)
          .order('created_at', { ascending: false })
      )
      // Pickup details only come back for accepted requests — the
      // database rules hide the rest, so this is safe to ask for.
      const acceptedIds = requests.filter((r) => r.status === 'accepted').map((r) => r.listing_id)
      if (acceptedIds.length) {
        const pickups = check(await supabase.from('listing_pickups').select('*').in('listing_id', acceptedIds))
        for (const r of requests) r.pickup = pickups.find((p) => p.listing_id === r.listing_id) ?? null
      }
      return requests
    },

    async requestListing(listingId, message) {
      check(await supabase.from('requests').insert({ listing_id: listingId, message: message || null }))
    },

    async respond(requestId, decision) {
      check(await supabase.rpc('respond_to_request', { request_id: requestId, decision }))
    },

    // Cancelling an accepted request also reopens the listing for others,
    // so it goes through a database function rather than a plain update.
    async cancelRequest(requestId) {
      check(await supabase.rpc('cancel_request', { request_id: requestId }))
    },

    // ---------- Report and block ----------
    // Reports go to a table that only the site's owner can read. Each one is
    // about a listing, or about a request someone made on your own listing.
    async reportListing(listingId, reason, note) {
      check(await supabase.rpc('submit_report', { p_listing_id: listingId, p_request_id: null, p_reason: reason, p_note: note || null }))
    },

    async reportRequest(requestId, reason, note) {
      check(await supabase.rpc('submit_report', { p_listing_id: null, p_request_id: requestId, p_reason: reason, p_note: note || null }))
    },

    // Blocking also ends open requests between the two people, in one step.
    async blockUser(userId) {
      check(await supabase.rpc('block_user', { p_user_id: userId }))
    },

    async myBlocks() {
      const uid = await currentUserId()
      return check(
        await supabase
          .from('blocks')
          .select('blocked_id, created_at, blocked:profiles!blocked_id(display_name, neighborhood)')
          .eq('blocker_id', uid)
          .order('created_at', { ascending: false })
      )
    },

    async unblockUser(userId) {
      const uid = await currentUserId()
      const rows = check(await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId).select('blocked_id'))
      if (!rows?.length) throw new Error('That block was not found.')
    }
  }
}

// Delete every photo file a person has uploaded (they live in a folder named
// after their user id). Best effort: it never stops the account deletion.
async function removeAllPhotosOf(supabase, uid) {
  try {
    for (let round = 0; round < 20; round++) {
      const { data: files, error } = await supabase.storage.from('produce-photos').list(uid, { limit: 100 })
      if (error || !files?.length) return
      const { error: removeError } = await supabase.storage
        .from('produce-photos')
        .remove(files.map((f) => `${uid}/${f.name}`))
      if (removeError) return
    }
  } catch {
    // Leave any stragglers rather than block the deletion.
  }
}

// A public photo URL ends in /produce-photos/<user id>/<file>.jpg; storage
// needs just the part after the bucket name.
function photoPathFromUrl(url) {
  const marker = '/produce-photos/'
  const i = url ? url.indexOf(marker) : -1
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

// Turn database error messages into something a neighbor can act on.
function friendlyError(message = '') {
  if (message.includes('row-level security') && message.includes('requests'))
    return 'You can’t request this. It may be gone, or you already have 3 open requests.'
  if (message.includes('duplicate key') && message.includes('requests'))
    return 'You already asked for this one.'
  if (message.includes('Invalid login credentials')) return 'That email and password don’t match.'
  if (message.includes('User already registered')) return 'That email already has an account. Sign in instead.'
  if (message.includes('Password should be')) return 'Use a password with at least 6 characters.'
  if (message.includes('should be different from the old password')) return 'Choose a password you haven’t used before.'
  if (message.includes('rate limit') || message.includes('security purposes'))
    return 'Too many requests right now. Wait a few minutes and try again.'
  if (message.includes('Could not find the function'))
    return 'This feature isn’t switched on yet. Please try again later.'
  if (message.includes('session missing') || message.includes('not authenticated'))
    return 'That reset link has expired. Ask for a new one.'
  return message || 'Something went wrong. Check your connection and try again.'
}
