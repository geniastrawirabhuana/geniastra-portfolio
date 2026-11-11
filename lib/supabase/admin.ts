import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** Trusted migration-only client. Never import this module from a request handler or client component. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !secretKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for trusted migration tasks.')
  return createSupabaseClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
}
