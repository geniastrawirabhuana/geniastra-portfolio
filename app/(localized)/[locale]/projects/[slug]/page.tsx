import Image from 'next/image'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { projects } from '@/content/portfolio'
import { getMessages } from '@/messages'
import { localePath, type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'
export const dynamicParams = false

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!params.locale) return []
  return projects.map((project) => ({ slug: project.slug }))
}
export async function generateMetadata({params}:{params:Promise<{locale:string;slug:string}>}):Promise<Metadata>{const {locale:localeParam,slug}=await params;const locale=localeParam as Locale;const p=projects.find(x=>x.slug===slug);if(!p)return {};return localizedMetadata(locale,`/projects/${p.slug}`,`${p.title} — ${locale === 'id' ? 'Proyek Website' : 'Web Project'}`,p.description[locale])}
export default async function ProjectDetail({params}:{params:Promise<{locale:string;slug:string}>}){const {locale:localeParam,slug}=await params;const locale=localeParam as Locale;const p=projects.find(x=>x.slug===slug);if(!p)notFound();const m=getMessages(locale);return <main className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28"><Link href={localePath(locale,'/projects')} className="inline-flex items-center gap-2 text-sm text-[#646872] hover:text-[#3559D8]"><ArrowLeft size={16}/>{m.back}</Link><div className="mt-16 border-b border-[#dededb] pb-12"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">{p.mark} · {p.period[locale]}</span><h1 className="mt-5 text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{p.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#646872]">{p.description[locale]}</p></div>{p.cover ? <section aria-label={`${p.title} cover`} className="border-b border-[#dededb] py-10"><figure className="overflow-hidden rounded-2xl border border-[#dededb] bg-[#f5f5f2]"><Image src={p.cover} alt={`${p.title} ${locale === 'id' ? 'sampul project' : 'project cover'}`} width={1200} height={630} priority className="h-auto w-full object-contain" /></figure></section> : null}{p.gallery?.length ? <section aria-label={`${p.title} screenshots`} className="grid gap-5 border-b border-[#dededb] py-10 sm:grid-cols-2">{p.gallery.map((image, index) => <figure key={image} className="overflow-hidden rounded-2xl border border-[#dededb] bg-[#f5f5f2]"><Image src={image} alt={`${p.title} ${locale === 'id' ? 'tangkapan layar' : 'screenshot'} ${index + 1}`} width={1200} height={630} className="h-auto w-full object-contain" /></figure>)}</section> : null}<div className="grid gap-12 py-12 sm:grid-cols-[.6fr_1.4fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#646872]">{m.role}</p><p className="mt-3 font-medium">{p.role[locale]}</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#646872]">{m.scope}</p><ul className="mt-3 space-y-3">{p.scope[locale].map(x=><li key={x} className="border-b border-[#dededb] pb-3 text-[#646872]">{x}</li>)}</ul></div></div></main>}
