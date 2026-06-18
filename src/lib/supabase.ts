import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Surface a clear, actionable message instead of a cryptic network failure.
  console.warn(
    '[playbook] Supabase is not configured. Copy .env.example to .env.local ' +
      'and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

// Created even when unconfigured so imports never crash; calls will simply
// fail until env vars are provided. Components check isSupabaseConfigured.
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-placeholder',
)

export const VIDEO_BUCKET = 'play-videos'
