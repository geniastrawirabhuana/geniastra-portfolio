'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'

type Localized = { id: string; en: string }
type SiteContent = {
  siteName: string
  fullName: string
  location: Localized
  home: { heroEyebrow: Localized; heroTitle: Localized; heroText: Localized; aboutEyebrow: Localized; aboutTitle: Localized; aboutText: Localized; strengthsList: { id: string[]; en: string[] } }
  about: { paragraphs: { id: string[]; en: string[] } }
  contact: { title: Localized; text: Localized; email: string; github: string; linkedin: string; cvUrl: string }
  experience: { education: { title: string; detail: Localized; period: string }[]; organization: { title: Localized; period: string }[] }
}

const fieldClass = 'mt-2 w-full rounded-lg border border-[#dededb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3559D8]'
const labelClass = 'block text-sm font-medium text-[#33353a]'

export function SiteContentEditor({ onBack }: { onBack: () => void }) {
  const [content, setContent] = useState<SiteContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/content', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Gagal memuat konten.')
        setContent(data)
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat konten.'))
  }, [])

  function updateLocalized(section: 'location' | 'heroEyebrow' | 'heroTitle' | 'heroText' | 'aboutEyebrow' | 'aboutTitle' | 'aboutText' | 'contactTitle' | 'contactText', locale: 'id' | 'en', value: string) {
    setContent((current) => {
      if (!current) return current
      if (section === 'location') return { ...current, location: { ...current.location, [locale]: value } }
      if (section === 'contactTitle' || section === 'contactText') {
        const field = section === 'contactTitle' ? 'title' : 'text'
        return { ...current, contact: { ...current.contact, [field]: { ...current.contact[field], [locale]: value } } }
      }
      return { ...current, home: { ...current.home, [section]: { ...current.home[section], [locale]: value } } }
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content) return
    setBusy(true)
    setMessage('')
    const payload = {
      ...content,
      about: { paragraphs: { id: content.about.paragraphs.id.flatMap((item) => item.split('\n')).map((item) => item.trim()).filter(Boolean), en: content.about.paragraphs.en.flatMap((item) => item.split('\n')).map((item) => item.trim()).filter(Boolean) } },
      home: { ...content.home, strengthsList: { id: content.home.strengthsList.id.flatMap((item) => item.split('\n')).map((item) => item.trim()).filter(Boolean), en: content.home.strengthsList.en.flatMap((item) => item.split('\n')).map((item) => item.trim()).filter(Boolean) } },
    }
    try {
      const response = await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Konten gagal disimpan.')
      setMessage('Konten halaman berhasil disimpan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Konten gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  if (!content) return <main className="mx-auto max-w-6xl px-5 py-20 text-sm text-[#646872]">{message || 'Memuat pengaturan situs…'}</main>

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dededb] pb-6">
      <div><button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-[#646872] hover:text-[#171717]"><ArrowLeft size={16} />Kembali ke proyek</button><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Konten halaman</h1><p className="mt-2 text-sm text-[#646872]">Ubah konten Indonesia dan Inggris. Perubahan tersimpan di database Supabase.</p></div>
    </header>
    {message && <p role="status" className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-[#45474d]">{message}</p>}
    <form onSubmit={save} className="mt-8 space-y-10">
      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Identitas situs</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Nama situs<input className={fieldClass} value={content.siteName} onChange={(event) => setContent({ ...content, siteName: event.target.value })} required /></label><label className={labelClass}>Nama lengkap<input className={fieldClass} value={content.fullName} onChange={(event) => setContent({ ...content, fullName: event.target.value })} required /></label></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={locale} className={labelClass}>Lokasi ({locale === 'id' ? 'Indonesia' : 'English'})<input className={fieldClass} value={content.location[locale]} onChange={(event) => updateLocalized('location', locale, event.target.value)} required /></label>)}</div>
      </section>

      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Beranda</h2>
        {(['heroEyebrow', 'heroTitle', 'heroText', 'aboutEyebrow', 'aboutTitle', 'aboutText'] as const).map((field) => <div key={field} className="mt-5"><p className="text-sm font-medium">{{ heroEyebrow: 'Label pembuka', heroTitle: 'Judul utama', heroText: 'Deskripsi utama', aboutEyebrow: 'Label bagian Tentang', aboutTitle: 'Judul bagian Tentang', aboutText: 'Deskripsi bagian Tentang' }[field]}</p><div className="mt-2 grid gap-3 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={locale} className="text-xs text-[#646872]">{locale === 'id' ? 'Indonesia' : 'English'}{field.endsWith('Text') || field.endsWith('Title') ? <textarea className={fieldClass} rows={field.endsWith('Title') ? 2 : 3} value={content.home[field][locale]} onChange={(event) => updateLocalized(field, locale, event.target.value)} required /> : <input className={fieldClass} value={content.home[field][locale]} onChange={(event) => updateLocalized(field, locale, event.target.value)} required />}</label>)}</div></div>)}
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Kekuatan (Indonesia)<textarea className={fieldClass} rows={4} value={content.home.strengthsList.id.join('\n')} onChange={(event) => setContent({ ...content, home: { ...content.home, strengthsList: { ...content.home.strengthsList, id: event.target.value.split('\n') } } })} /></label><label className={labelClass}>Strengths (English)<textarea className={fieldClass} rows={4} value={content.home.strengthsList.en.join('\n')} onChange={(event) => setContent({ ...content, home: { ...content.home, strengthsList: { ...content.home.strengthsList, en: event.target.value.split('\n') } } })} /></label></div>
      </section>

      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Tentang</h2><p className="mt-1 text-sm text-[#646872]">Tulis satu paragraf per baris untuk setiap bahasa.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Paragraf (Indonesia)<textarea className={fieldClass} rows={8} value={content.about.paragraphs.id.join('\n')} onChange={(event) => setContent({ ...content, about: { paragraphs: { ...content.about.paragraphs, id: event.target.value.split('\n') } } })} /></label><label className={labelClass}>Paragraphs (English)<textarea className={fieldClass} rows={8} value={content.about.paragraphs.en.join('\n')} onChange={(event) => setContent({ ...content, about: { paragraphs: { ...content.about.paragraphs, en: event.target.value.split('\n') } } })} /></label></div>
      </section>

      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Pengalaman pendidikan</h2>
        {content.experience.education.map((entry, index) => <div key={`education-${index}`} className="mt-5 rounded-lg border border-[#dededb] p-4"><div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]"><label className={labelClass}>Institusi<input className={fieldClass} value={entry.title} onChange={(event) => setContent({ ...content, experience: { ...content.experience, education: content.experience.education.map((item, i) => i === index ? { ...item, title: event.target.value } : item) } })} required /></label><label className={labelClass}>Periode<input className={fieldClass} value={entry.period} onChange={(event) => setContent({ ...content, experience: { ...content.experience, education: content.experience.education.map((item, i) => i === index ? { ...item, period: event.target.value } : item) } })} required /></label><button type="button" onClick={() => setContent({ ...content, experience: { ...content.experience, education: content.experience.education.filter((_, i) => i !== index) } })} aria-label="Hapus pendidikan" className="self-end rounded p-3 text-red-700"><Trash2 size={17} /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={locale} className={labelClass}>Detail ({locale === 'id' ? 'Indonesia' : 'English'})<input className={fieldClass} value={entry.detail[locale]} onChange={(event) => setContent({ ...content, experience: { ...content.experience, education: content.experience.education.map((item, i) => i === index ? { ...item, detail: { ...item.detail, [locale]: event.target.value } } : item) } })} required /></label>)}</div></div>)}
        <button type="button" onClick={() => setContent({ ...content, experience: { ...content.experience, education: [...content.experience.education, { title: '', detail: { id: '', en: '' }, period: '' }] } })} className="mt-4 rounded-lg border border-[#dededb] px-4 py-2 text-sm">+ Tambah pendidikan</button>
      </section>

      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Pengalaman organisasi</h2>
        {content.experience.organization.map((entry, index) => <div key={`organization-${index}`} className="mt-5 rounded-lg border border-[#dededb] p-4"><div className="grid gap-3 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={locale} className={labelClass}>Jabatan ({locale === 'id' ? 'Indonesia' : 'English'})<input className={fieldClass} value={entry.title[locale]} onChange={(event) => setContent({ ...content, experience: { ...content.experience, organization: content.experience.organization.map((item, i) => i === index ? { ...item, title: { ...item.title, [locale]: event.target.value } } : item) } })} required /></label>)}</div><div className="mt-3 flex gap-3"><label className={`${labelClass} flex-1`}>Periode<input className={fieldClass} value={entry.period} onChange={(event) => setContent({ ...content, experience: { ...content.experience, organization: content.experience.organization.map((item, i) => i === index ? { ...item, period: event.target.value } : item) } })} required /></label><button type="button" onClick={() => setContent({ ...content, experience: { ...content.experience, organization: content.experience.organization.filter((_, i) => i !== index) } })} aria-label="Hapus organisasi" className="self-end rounded p-3 text-red-700"><Trash2 size={17} /></button></div></div>)}
        <button type="button" onClick={() => setContent({ ...content, experience: { ...content.experience, organization: [...content.experience.organization, { title: { id: '', en: '' }, period: '' }] } })} className="mt-4 rounded-lg border border-[#dededb] px-4 py-2 text-sm">+ Tambah organisasi</button>
      </section>

      <section className="rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Kontak</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={`contact-title-${locale}`} className={labelClass}>Judul ({locale === 'id' ? 'Indonesia' : 'English'})<input className={fieldClass} value={content.contact.title[locale]} onChange={(event) => setContent({ ...content, contact: { ...content.contact, title: { ...content.contact.title, [locale]: event.target.value } } })} required /></label>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <label key={`contact-text-${locale}`} className={labelClass}>Deskripsi ({locale === 'id' ? 'Indonesia' : 'English'})<textarea className={fieldClass} rows={3} value={content.contact.text[locale]} onChange={(event) => setContent({ ...content, contact: { ...content.contact, text: { ...content.contact.text, [locale]: event.target.value } } })} required /></label>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Email<input className={fieldClass} type="email" value={content.contact.email} onChange={(event) => setContent({ ...content, contact: { ...content.contact, email: event.target.value } })} /></label><label className={labelClass}>URL CV<input className={fieldClass} value={content.contact.cvUrl} onChange={(event) => setContent({ ...content, contact: { ...content.contact, cvUrl: event.target.value } })} placeholder="https://… atau /cv.pdf" /></label><label className={labelClass}>GitHub URL<input className={fieldClass} type="url" value={content.contact.github} onChange={(event) => setContent({ ...content, contact: { ...content.contact, github: event.target.value } })} /></label><label className={labelClass}>LinkedIn URL<input className={fieldClass} type="url" value={content.contact.linkedin} onChange={(event) => setContent({ ...content, contact: { ...content.contact, linkedin: event.target.value } })} /></label></div>
      </section>

      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"><Save size={16} />{busy ? 'Menyimpan…' : 'Simpan semua konten'}</button>
    </form>
  </main>
}
