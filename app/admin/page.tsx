import { AdminPanel } from './admin-panel'
import type { Metadata } from 'next'
import { getAdminAccess } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin — GENIASTRA', robots: { index: false, follow: false, noarchive: true } }

export default async function AdminPage() {
  const configured = isSupabaseConfigured
  const access = configured ? await getAdminAccess() : undefined
  return <AdminPanel initialConfigured={configured} initialAuthenticated={access?.status === 'allowed'} />
}
