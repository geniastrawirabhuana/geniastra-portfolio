import 'server-only'
import { createClient } from './server'
import { NextResponse } from 'next/server'

export type AdminAccess = { status: 'unauthenticated' | 'forbidden' | 'allowed'; userId?: string }

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { status: 'unauthenticated' }
  const { data, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (adminError || !data) return { status: 'forbidden', userId: user.id }
  return { status: 'allowed', userId: user.id }
}

export async function authorizeAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase, access: { status: 'unauthenticated' as const } }
  const { data, error: adminError } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (adminError || !data) return { supabase, access: { status: 'forbidden' as const, userId: user.id } }
  return { supabase, access: { status: 'allowed' as const, userId: user.id } }
}

export function adminAccessError(status: AdminAccess['status']) {
  const code = status === 'unauthenticated' ? 401 : 403
  const message = status === 'unauthenticated' ? 'Silakan login sebagai admin terlebih dahulu.' : 'Akun ini tidak memiliki akses admin.'
  return NextResponse.json({ error: message }, { status: code, headers: { 'Cache-Control': 'private, no-store' } })
}
