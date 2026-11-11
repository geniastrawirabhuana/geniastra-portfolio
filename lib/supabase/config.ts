export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export function requireSupabaseConfig() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  return { url: supabaseUrl, publishableKey: supabasePublishableKey }
}
