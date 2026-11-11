'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, LogOut, Plus, Save, Trash2 } from 'lucide-react'
import { SiteContentEditor } from './site-content-editor'

type Locale = 'id' | 'en'
type Translation = { title: string; short_description: string; description: string; role: string; period_label: string; mark: string; scope: string[]; seo_title: string; seo_description: string }
type Media = { storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id: string; alt_text_en: string; caption_id: string; caption_en: string; display_order: number; url?: string }
type AdminProject = { id?: string; slug: string; category: string; status: 'draft' | 'published'; featured: boolean; display_order: number; project_url: string; github_url: string; start_date: string; end_date: string; translations: Record<Locale, Translation>; media: Media[] }
const emptyTranslation = (): Translation => ({ title: '', short_description: '', description: '', role: '', period_label: '', mark: '', scope: [], seo_title: '', seo_description: '' })
const emptyProject = (): AdminProject => ({ slug: '', category: 'website', status: 'draft', featured: false, display_order: 100, project_url: '', github_url: '', start_date: '', end_date: '', translations: { id: emptyTranslation(), en: emptyTranslation() }, media: [] })
const fieldClass = 'mt-2 w-full rounded-lg border border-[#dededb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3559D8]'
const labelClass = 'block text-sm font-medium text-[#33353a]'

export function AdminPanel({ initialConfigured, initialAuthenticated }: { initialConfigured: boolean; initialAuthenticated: boolean }) {
  const [configured, setConfigured] = useState(initialConfigured)
  const [authenticated, setAuthenticated] = useState(initialAuthenticated)
  const [ready, setReady] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [project, setProject] = useState<AdminProject>(emptyProject)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'projects' | 'content'>('projects')

  async function loadProjects() {
    const response = await fetch('/api/admin/projects', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Gagal memuat proyek.')
    setProjects(data.projects)
  }

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json()
      setConfigured(data.configured === true)
      if (data.authenticated) { setAuthenticated(true); await loadProjects() }
      else if (data.forbidden) setMessage('Akun ini belum masuk daftar administrator yang diizinkan.')
    }).catch(() => setMessage('Tidak dapat memeriksa sesi admin.')).finally(() => setReady(true))
  }, [])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login gagal.')
      setAuthenticated(true); setPassword(''); await loadProjects()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login gagal.') }
    finally { setBusy(false) }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' })
    setAuthenticated(false); setProjects([]); setProject(emptyProject()); setEditingSlug(null); setMessage('')
  }

  function editProject(item: AdminProject) {
    setProject({ ...item, translations: { id: { ...item.translations.id, scope: [...item.translations.id.scope] }, en: { ...item.translations.en, scope: [...item.translations.en.scope] } }, media: item.media.map((media) => ({ ...media })) })
    setEditingSlug(item.slug); setMessage('')
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const intent = (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement ? (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') : null
    const payload = { ...project, status: intent === 'published' ? 'published' : intent === 'unpublish' ? 'draft' : project.status, translations: Object.fromEntries((['id', 'en'] as const).map((locale) => [locale, { ...project.translations[locale], scope: project.translations[locale].scope.flatMap((line) => line.split('\n')).map((line) => line.trim()).filter(Boolean) }])) }
    try {
      const response = await fetch(editingSlug ? `/api/admin/projects/${encodeURIComponent(editingSlug)}` : '/api/admin/projects', { method: editingSlug ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Proyek gagal disimpan.')
      setProject(data.project); setEditingSlug(data.project.slug); await loadProjects()
      setMessage(data.warning || (payload.status === 'published' ? 'Proyek berhasil diterbitkan.' : 'Draf proyek berhasil disimpan.'))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Proyek gagal disimpan.') }
    finally { setBusy(false) }
  }

  async function deleteProject(slug: string) {
    if (!window.confirm(`Hapus proyek “${slug}”?`)) return
    const response = await fetch(`/api/admin/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error || 'Proyek gagal dihapus.')
    await loadProjects(); if (editingSlug === slug) { setProject(emptyProject()); setEditingSlug(null) }
    setMessage(data.warning || 'Proyek berhasil dihapus.')
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>, target: 'cover' | 'gallery') {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    if (!project.id) { setMessage('Simpan draf terlebih dahulu sebelum mengunggah gambar.'); event.target.value = ''; return }
    setBusy(true); setMessage('Mengunggah gambar…')
    try {
      const uploaded: Media[] = []
      for (const file of files) {
        const form = new FormData(); form.set('file', file); form.set('projectId', project.id)
        const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `Gagal mengunggah ${file.name}.`)
        uploaded.push({ storage_path: data.storage_path, url: data.url, media_type: target, alt_text_id: '', alt_text_en: '', caption_id: '', caption_en: '', display_order: project.media.length + uploaded.length })
      }
      setProject((current) => ({ ...current, media: target === 'cover' ? [...current.media.filter((media) => media.media_type !== 'cover'), uploaded[0]] : [...current.media, ...uploaded] }))
      setMessage('Gambar terunggah. Simpan proyek untuk menyimpan metadata gambarnya.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal mengunggah gambar.') }
    finally { setBusy(false); event.target.value = '' }
  }

  function changeTranslation(locale: Locale, field: keyof Translation, value: string) {
    setProject((current) => ({ ...current, translations: { ...current.translations, [locale]: { ...current.translations[locale], [field]: field === 'scope' ? value.split('\n') : value } } }))
  }
  function changeMedia(index: number, field: keyof Media, value: string) {
    setProject((current) => ({ ...current, media: current.media.map((media, i) => i === index ? { ...media, [field]: value } : media) }))
  }
  function moveGallery(index: number, direction: -1 | 1) {
    const galleries = project.media.filter((media) => media.media_type === 'gallery')
    const mediaIndex = project.media.findIndex((media) => media === galleries[index])
    const nextIndex = project.media.findIndex((media) => media === galleries[index + direction])
    if (mediaIndex < 0 || nextIndex < 0) return
    const next = [...project.media]; [next[mediaIndex], next[nextIndex]] = [next[nextIndex], next[mediaIndex]]
    setProject({ ...project, media: next.map((item, order) => ({ ...item, display_order: order })) })
  }

  if (!ready) return <main className="mx-auto max-w-6xl px-5 py-20 text-sm text-[#646872]">Memuat panel admin…</main>
  if (!configured) return <main className="mx-auto max-w-xl px-5 py-24"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-4 text-4xl font-semibold">Supabase belum dikonfigurasi</h1><p className="mt-4 leading-7 text-[#646872]">Admin dan perubahan konten dinonaktifkan. Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> setelah membuat project Supabase, jalankan migrasi SQL, lalu buat akun admin dan masukkan UUID-nya ke tabel <code>admin_users</code>.</p></main>
  if (!authenticated) return <main className="mx-auto max-w-md px-5 py-24"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">Masuk admin</h1><p className="mt-3 text-sm leading-6 text-[#646872]">Gunakan akun administrator yang sudah diizinkan oleh pemilik situs.</p><form onSubmit={login} className="mt-8 space-y-4"><label className={labelClass}>Email<input className={fieldClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className={labelClass}>Password<input className={fieldClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button disabled={busy} className="w-full rounded-lg bg-[#171717] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Memeriksa…' : 'Masuk'}</button></form>{message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}</main>
  if (view === 'content') return <SiteContentEditor onBack={() => setView('projects')} />

  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dededb] pb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Kelola proyek</h1><p className="mt-2 text-sm text-[#646872]">Proyek disimpan di Supabase dan tampil di situs setelah diterbitkan.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setView('content')} className="rounded-lg border border-[#dededb] px-4 py-2.5 text-sm">Konten situs</button><button onClick={() => { setProject(emptyProject()); setEditingSlug(null); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg bg-[#3559D8] px-4 py-2.5 text-sm font-medium text-white"><Plus size={16}/>Proyek baru</button><button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-[#dededb] px-4 py-2.5 text-sm"><LogOut size={16}/>Keluar</button></div></header>
    {message && <p role="status" className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-[#45474d]">{message}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.5fr)]">
      <aside className="space-y-3"><h2 className="text-sm font-semibold">Daftar proyek ({projects.length})</h2>{projects.length ? projects.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-lg border p-3 ${editingSlug === item.slug ? 'border-[#3559D8] bg-white' : 'border-[#dededb]'}`}><button onClick={() => editProject(item)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{item.translations.en.title || item.translations.id.title || 'Draf tanpa judul'}</span><span className="block truncate text-xs text-[#646872]">{item.status} · /{item.slug}</span></button><button onClick={() => deleteProject(item.slug)} aria-label={`Hapus ${item.slug}`} className="rounded p-2 text-[#646872] hover:bg-red-50 hover:text-red-700"><Trash2 size={16}/></button></div>) : <p className="rounded-lg border border-dashed border-[#cfcfca] p-4 text-sm text-[#646872]">Belum ada proyek di database Supabase.</p>}</aside>
      <form onSubmit={saveProject} className="space-y-6 rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{editingSlug ? 'Edit proyek' : 'Tambah proyek'}</h2>{editingSlug && <button type="button" onClick={() => { setProject(emptyProject()); setEditingSlug(null); setMessage('') }} className="text-sm text-[#646872]">Batal edit</button>}</div>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]"><label className={labelClass}>Slug URL<input className={fieldClass} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={project.slug} onChange={(event) => setProject({ ...project, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /></label><label className={labelClass}>Kategori<select className={fieldClass} value={project.category} onChange={(event) => setProject({ ...project, category: event.target.value })}><option value="website">Website</option><option value="web-application">Web application</option><option value="chatbot">Chatbot</option><option value="other">Lainnya</option></select></label></div>
        <div className="grid gap-5 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <section key={locale} className="space-y-3 rounded-lg border border-[#dededb] p-4"><h3 className="text-sm font-semibold">{locale === 'id' ? 'Bahasa Indonesia' : 'English'}</h3><label className={labelClass}>Judul<input className={fieldClass} value={project.translations[locale].title} onChange={(event) => changeTranslation(locale, 'title', event.target.value)} /></label><label className={labelClass}>Deskripsi singkat<textarea className={fieldClass} rows={2} value={project.translations[locale].short_description} onChange={(event) => changeTranslation(locale, 'short_description', event.target.value)} /></label><label className={labelClass}>Deskripsi lengkap<textarea className={fieldClass} rows={4} value={project.translations[locale].description} onChange={(event) => changeTranslation(locale, 'description', event.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label className={labelClass}>Peran<input className={fieldClass} value={project.translations[locale].role} onChange={(event) => changeTranslation(locale, 'role', event.target.value)} /></label><label className={labelClass}>Periode<input className={fieldClass} value={project.translations[locale].period_label} onChange={(event) => changeTranslation(locale, 'period_label', event.target.value)} /></label></div><label className={labelClass}>Tanda singkat<input className={fieldClass} maxLength={12} value={project.translations[locale].mark} onChange={(event) => changeTranslation(locale, 'mark', event.target.value.toUpperCase())} /></label><label className={labelClass}>Ruang lingkup<textarea className={fieldClass} rows={4} value={project.translations[locale].scope.join('\n')} onChange={(event) => changeTranslation(locale, 'scope', event.target.value)} placeholder="Satu item per baris" /></label><label className={labelClass}>Judul SEO<input className={fieldClass} value={project.translations[locale].seo_title} onChange={(event) => changeTranslation(locale, 'seo_title', event.target.value)} /></label><label className={labelClass}>Deskripsi SEO<textarea className={fieldClass} rows={2} value={project.translations[locale].seo_description} onChange={(event) => changeTranslation(locale, 'seo_description', event.target.value)} /></label></section>)}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Tanggal mulai<input className={fieldClass} type="date" value={project.start_date} onChange={(event) => setProject({ ...project, start_date: event.target.value })} /></label><label className={labelClass}>Tanggal selesai<input className={fieldClass} type="date" value={project.end_date} onChange={(event) => setProject({ ...project, end_date: event.target.value })} /></label><label className={labelClass}>URL proyek<input className={fieldClass} type="url" value={project.project_url} onChange={(event) => setProject({ ...project, project_url: event.target.value })} /></label><label className={labelClass}>URL GitHub<input className={fieldClass} type="url" value={project.github_url} onChange={(event) => setProject({ ...project, github_url: event.target.value })} /></label></div>
        <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={project.featured} onChange={(event) => setProject({ ...project, featured: event.target.checked })}/>Proyek pilihan</label><label className="flex items-center gap-2 text-sm">Urutan<input className="w-24 rounded border border-[#dededb] px-2 py-1" type="number" min="0" value={project.display_order} onChange={(event) => setProject({ ...project, display_order: Number(event.target.value) })}/></label><span className="text-sm text-[#646872]">Status: {project.status}</span></div>
        <section className="space-y-4 border-t border-[#dededb] pt-5"><div><h3 className="font-semibold">Media proyek</h3><p className="mt-1 text-xs text-[#646872]">JPEG, PNG, WebP, AVIF; maksimal 10 MB. Simpan draf sebelum upload.</p></div><label className={labelClass}>Gambar sampul<input disabled={!project.id || busy} className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => uploadImages(event, 'cover')}/></label><label className={labelClass}>Tambah gambar galeri<input disabled={!project.id || busy} className={fieldClass} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => uploadImages(event, 'gallery')}/></label>{project.media.map((media, index) => <div key={media.storage_path} className="grid gap-3 rounded-lg border border-[#dededb] p-4 sm:grid-cols-[100px_1fr_auto]">{media.url ? <Image src={media.url} alt="" width={96} height={80} unoptimized className="h-20 w-24 rounded object-cover"/> : <div className="h-20 w-24 rounded bg-[#f1f1ee]"/>}<div className="grid gap-2 sm:grid-cols-2"><p className="col-span-full truncate text-xs text-[#646872]">{media.media_type === 'cover' ? 'Sampul' : `Galeri ${media.display_order + 1}`}: {media.storage_path}</p><input className={fieldClass} aria-label="Alt Indonesia" placeholder="Alt Indonesia" value={media.alt_text_id} onChange={(event) => changeMedia(index, 'alt_text_id', event.target.value)}/><input className={fieldClass} aria-label="Alt English" placeholder="Alt English" value={media.alt_text_en} onChange={(event) => changeMedia(index, 'alt_text_en', event.target.value)}/><input className={fieldClass} aria-label="Caption Indonesia" placeholder="Caption Indonesia" value={media.caption_id} onChange={(event) => changeMedia(index, 'caption_id', event.target.value)}/><input className={fieldClass} aria-label="Caption English" placeholder="Caption English" value={media.caption_en} onChange={(event) => changeMedia(index, 'caption_en', event.target.value)}/></div><div className="flex items-center gap-1"><button type="button" disabled={media.media_type === 'cover'} onClick={() => moveGallery(project.media.filter((item) => item.media_type === 'gallery').findIndex((item) => item.storage_path === media.storage_path), -1)} aria-label="Naikkan urutan" className="rounded p-2 disabled:opacity-30"><ArrowUp size={16}/></button><button type="button" disabled={media.media_type === 'cover'} onClick={() => moveGallery(project.media.filter((item) => item.media_type === 'gallery').findIndex((item) => item.storage_path === media.storage_path), 1)} aria-label="Turunkan urutan" className="rounded p-2 disabled:opacity-30"><ArrowDown size={16}/></button><button type="button" onClick={() => setProject({ ...project, media: project.media.filter((_, i) => i !== index) })} aria-label="Hapus gambar" className="rounded p-2 text-red-700"><Trash2 size={16}/></button></div></div>)}</section>
        <div className="flex flex-wrap gap-3 border-t border-[#dededb] pt-5"><button disabled={busy} value="draft" className="inline-flex items-center gap-2 rounded-lg border border-[#dededb] px-5 py-3 text-sm font-medium disabled:opacity-50"><Save size={16}/>{busy ? 'Menyimpan…' : 'Simpan draf'}</button><button disabled={busy} value="published" className="rounded-lg bg-[#3559D8] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">Terbitkan</button>{project.status === 'published' && <button disabled={busy} value="unpublish" className="rounded-lg border border-[#dededb] px-5 py-3 text-sm">Jadikan draf</button>}</div>
      </form>
    </div>
  </main>
}
