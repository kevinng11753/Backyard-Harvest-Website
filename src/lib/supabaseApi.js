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
      const { data } = supabase.auth.onAuthStateChange(() => callback())
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
    }
  }
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
  return message || 'Something went wrong. Check your connection and try again.'
}
