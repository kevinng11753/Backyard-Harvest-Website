// Picks the backend: live Supabase if keys are set in .env.local,
// otherwise demo mode.
import { createSupabaseApi } from './supabaseApi.js'
import { createDemoApi } from './demoApi.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Following a password-reset email brings the person back with a hint in the
// address: #...type=recovery, or an error if the link expired or was already
// used. Read it here, before the Supabase client tidies the address away.
const hash = typeof window === 'undefined' ? '' : window.location.hash
export const startedInRecovery = /type=recovery/.test(hash)
export const resetLinkExpired = /error_code=otp_expired/.test(hash)

export const api = url && key ? createSupabaseApi(url, key) : createDemoApi()
