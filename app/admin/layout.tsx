import type { ReactNode } from 'react'
import '../globals.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <html lang="id"><body className="min-h-screen bg-[#f8f8f6] text-[#171717] antialiased">{children}</body></html>
}
