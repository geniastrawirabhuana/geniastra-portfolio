import Image from 'next/image'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getMessages } from '@/messages'
import { localePath, type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'
import { getPortfolioProject } from '@/lib/projects'
import { projectSeoDescription } from '@/lib/project-display'

export const dynamicParams = true

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as Locale
  const project = await getPortfolioProject(slug, locale)
  if (!project) return {}
  return localizedMetadata(locale, `/projects/${project.slug}`, project.seoTitle || `${project.title} — ${locale === 'id' ? 'Proyek Website' : 'Web Project'}`, projectSeoDescription(project, locale))
}

export default async function ProjectDetail({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as Locale
  const project = await getPortfolioProject(slug, locale)
  if (!project) notFound()
  const messages = getMessages(locale)
  return <main className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
    <Link href={localePath(locale, '/projects')} className="inline-flex items-center gap-2 text-sm text-[#646872] hover:text-[#3559D8]"><ArrowLeft size={16}/>{messages.back}</Link>
    <div className="mt-16 border-b border-[#dededb] pb-12"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">{project.mark} · {project.period[locale]}</span><h1 className="mt-5 text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{project.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#646872]">{project.shortDescription[locale]}</p></div>
    {project.cover ? <section aria-label={`${project.title} cover`} className="border-b border-[#dededb] py-10"><figure className="overflow-hidden rounded-2xl border border-[#dededb] bg-[#f5f5f2]"><Image src={project.cover} alt={project.coverAlt ?? `${project.title} project cover`} width={1200} height={630} priority className="h-auto w-full object-contain" /></figure></section> : null}
    {project.galleryItems?.length ? <section aria-label={`${project.title} screenshots`} className="grid gap-5 border-b border-[#dededb] py-10 sm:grid-cols-2">{project.galleryItems.map((image, index) => <figure key={image.url} className="overflow-hidden rounded-2xl border border-[#dededb] bg-[#f5f5f2]"><Image src={image.url} alt={image.alt || `${project.title} screenshot ${index + 1}`} width={1200} height={630} className="h-auto w-full object-contain" />{image.caption ? <figcaption className="p-3 text-sm text-[#646872]">{image.caption}</figcaption> : null}</figure>)}</section> : null}
    {project.description[locale] ? <section className="border-b border-[#dededb] py-10 leading-8 text-[#646872]"><p>{project.description[locale]}</p></section> : null}
    <div className="grid gap-12 py-12 sm:grid-cols-[.6fr_1.4fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#646872]">{messages.role}</p><p className="mt-3 font-medium">{project.role[locale]}</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#646872]">{messages.scope}</p><ul className="mt-3 space-y-3">{project.scope[locale].map((item) => <li key={item} className="border-b border-[#dededb] pb-3 text-[#646872]">{item}</li>)}</ul>{project.technologies?.length ? <p className="mt-5 text-sm text-[#646872]">{project.technologies.join(' · ')}</p> : null}<div className="mt-5 flex gap-4 text-sm">{project.projectUrl ? <a href={project.projectUrl} rel="noreferrer" className="underline">Project</a> : null}{project.githubUrl ? <a href={project.githubUrl} rel="noreferrer" className="underline">GitHub</a> : null}</div></div></div>
  </main>
}
