import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/site'
import { getPortfolioProjects } from '@/lib/projects'
import { getLocalizedSiteContent } from '@/lib/site-content'
import { localePath, type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'
import { getMessages } from '@/messages'


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale
  return localizedMetadata(
    locale,
    '/',
    locale === 'id' ? 'GENIASTRA — Portofolio Web Developer' : 'GENIASTRA — Web Developer Portfolio',
    locale === 'id'
      ? 'Portofolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.'
      : 'GENIASTRA portfolio for web development, project management, and information technology.'
  )
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const m = getMessages(locale)
  const content = await getLocalizedSiteContent(locale)
  const featured = (await getPortfolioProjects(locale)).filter((project) => project.featured)
  return <>
    <main>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-24 sm:px-8 md:grid-cols-[1.25fr_0.75fr] md:items-end md:pt-32">
        <div>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#3559D8]">{content.heroEyebrow}</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">{content.heroTitle}</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[#646872]">{content.heroText}</p>
          <div className="mt-10 flex flex-wrap gap-3"><Link href={localePath(locale, '/projects')} className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3559D8]">{m.viewProjects}<ArrowUpRight size={16}/></Link><Link href={localePath(locale, '/contact')} className="inline-flex items-center rounded-full border border-[#cfcfca] px-5 py-3 text-sm font-medium hover:border-[#171717]">{m.contactMe}</Link></div>
        </div>
        <div className="border-l border-[#dededb] pl-6 text-sm leading-7 text-[#646872]"><p>{content.location}</p><p className="mt-6 font-medium text-[#171717]">{content.location}<br/>{content.education[0]?.period}</p></div>
      </section>
      <section className="border-y border-[#dededb] bg-[#f1f1ee] px-5 py-20 sm:px-8"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow={m.selected} title={m.selectedTitle}/><div className="grid gap-4 md:grid-cols-3">{featured.map((project)=><Link key={project.slug} href={localePath(locale, `/projects/${project.slug}`)} className="group flex min-h-64 flex-col justify-between rounded-2xl border border-[#dededb] bg-[#f8f8f6] p-6 transition hover:-translate-y-1 hover:border-[#3559D8]"><div>{project.cover ? <div className="mb-6 overflow-hidden rounded-xl border border-[#dededb] bg-white"><Image src={project.cover} alt={`${project.title} ${locale === 'id' ? 'sampul project' : 'project cover'}`} width={1200} height={630} className="h-auto w-full object-contain" /></div> : null}<div className="mb-10 flex items-center justify-between"><span className="text-xs font-semibold tracking-[0.18em] text-[#646872]">{project.mark}</span><ArrowUpRight className="text-[#646872] transition group-hover:text-[#3559D8]" size={18}/></div><h2 className="text-xl font-semibold tracking-[-0.03em]">{project.title}</h2><p className="mt-3 text-sm leading-6 text-[#646872]">{project.shortDescription[locale]}</p></div><span className="mt-8 text-xs uppercase tracking-[0.14em] text-[#646872]">{project.period[locale]}</span></Link>)}</div></div></section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="grid gap-10 md:grid-cols-2"><div><SectionHeading eyebrow={content.aboutEyebrow} title={content.aboutTitle}/><p className="max-w-xl leading-8 text-[#646872]">{content.aboutText}</p><Link className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline decoration-[#3559D8] underline-offset-4" href={localePath(locale, '/about')}>{m.nav.about}<ArrowUpRight size={15}/></Link></div><div className="border-t border-[#dededb] pt-5 text-sm"><div className="flex justify-between border-b border-[#dededb] py-4"><span className="text-[#646872]">{m.education}</span><span className="text-right font-medium">{content.education[0]?.title}<br/>{content.education[0]?.period}</span></div><div className="flex justify-between py-4"><span className="text-[#646872]">{m.strengths}</span><span className="text-right font-medium">{content.strengths.map((strength, index) => <span key={`${strength}-${index}`}>{index > 0 && <br/>}{strength}</span>)}</span></div></div></div></section>
    </main>
  </>
}
