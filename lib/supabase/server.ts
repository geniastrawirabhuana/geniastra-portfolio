import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { requireSupabaseConfig } from './config'

export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig()
  const cookieStore = await cookies()
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions before rendering.
        }
      },
    },
  })
}
