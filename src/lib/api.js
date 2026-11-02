// Picks the backend: live Supabase if keys are set in .env.local,
// otherwise demo mode.
import { createSupabaseApi } from './supabaseApi.js'
import { createDemoApi } from './demoApi.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const api = url && key ? createSupabaseApi(url, key) : createDemoApi()
