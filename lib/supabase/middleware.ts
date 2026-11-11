import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!isSupabaseConfigured) return response
  let sessionRefreshed = false

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        sessionRefreshed = true
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getClaims()
  if (sessionRefreshed || request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/') || request.nextUrl.pathname.startsWith('/api/admin/')) {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}
