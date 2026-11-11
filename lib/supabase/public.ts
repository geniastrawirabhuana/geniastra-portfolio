import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config'

export function createPublicClient() {
  if (!isSupabaseConfigured) return null
  return createSupabaseClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        cache: 'force-cache',
        next: { revalidate: 3600, tags: ['public-projects', 'public-site-content'] },
      }),
    },
  })
}
