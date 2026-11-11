import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { getMessages } from '@/messages'
import { type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'
import { getLocalizedSiteContent } from '@/lib/site-content'


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const l = locale as Locale
  const content = await getLocalizedSiteContent(l)
  return localizedMetadata(l, l === 'id' ? 'Kontak' : 'Contact', content.contactTitle, content.contactText)
}

export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale
  const m = getMessages(locale)
  const content = await getLocalizedSiteContent(locale)
  const links: { label: string; href: string }[] = []

  if (content.email) links.push({ label: 'Email', href: `mailto:${content.email}` })
  if (content.github) links.push({ label: 'GitHub', href: content.github })
  if (content.linkedin) links.push({ label: 'LinkedIn', href: content.linkedin })

  return <main className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
    <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">{m.nav.contact}</p>
    <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{content.contactTitle}</h1>
    <p className="mt-8 max-w-xl text-lg leading-8 text-[#646872]">{content.contactText}</p>
    <div className="mt-16 grid gap-3 sm:grid-cols-2">
      {links.length ? links.map((link) => <a key={link.label} href={link.href} className="flex items-center justify-between border border-[#dededb] p-5 hover:border-[#3559D8]">
        {link.label}<ArrowUpRight size={18} aria-hidden="true" />
      </a>) : <div className="border border-dashed border-[#cfcfca] p-5 text-sm text-[#646872]">{m.placeholder}</div>}
      {content.cvUrl ? <a href={content.cvUrl} className="flex items-center justify-between border border-[#dededb] p-5 hover:border-[#3559D8]">
        {locale === 'id' ? 'Unduh CV' : 'Download CV'}<ArrowUpRight size={18} aria-hidden="true" />
      </a> : <div className="border border-dashed border-[#cfcfca] p-5 text-sm text-[#646872]">{m.cv}</div>}
    </div>
  </main>
}
