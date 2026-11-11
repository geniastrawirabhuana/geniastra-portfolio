'use client'

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, ImagePlus, Languages, LogOut, Plus, Replace, Save, Trash2, X } from 'lucide-react'
import { SiteContentEditor } from './site-content-editor'
import { emptyAdminProject, normalizeAdminProject, type AdminMedia as Media, type AdminProject, type AdminTranslation as Translation, type AdminLocale as Locale } from '@/lib/admin-project-form'
import { formatFileSize, openNativeFilePicker, queueImageFiles, type PendingImage } from '@/lib/admin-media'
import { hasEnglishProjectContent, mergeTranslatedProjectFields, type ProjectEnglishFields } from '@/lib/translation/project-fields'

type PendingUpload = PendingImage
const emptyProject = emptyAdminProject

const fieldClass = 'mt-2 w-full rounded-lg border border-[#dededb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3559D8]'
const labelClass = 'block text-sm font-medium text-[#33353a]'
const imageAccept = 'image/jpeg,image/png,image/webp,image/avif'

function toEnglishSource(value: Translation): ProjectEnglishFields {
  return { title: value.title, short_description: value.short_description, description: value.description, role: value.role, scope: value.scope.map((line) => line.trim()).filter(Boolean) }
}

function PickerButton({ id, title, hint, inputId, multiple, inputRef, onChange, onDropFiles }: {
  id: string
  title: string
  hint: string
  inputId: string
  multiple?: boolean
  inputRef: { current: HTMLInputElement | null }
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDropFiles: (files: FileList | null) => void
}) {
  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    onDropFiles(event.dataTransfer.files)
  }

  return <>
    <input id={inputId} ref={inputRef} type="file" accept={imageAccept} multiple={multiple} onChange={onChange} className="sr-only" aria-label={title} />
    <button
      id={id}
      type="button"
      aria-controls={inputId}
      onClick={() => openNativeFilePicker(inputRef.current)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
      className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#b9c0d4] bg-[#f8f9fc] px-4 py-5 text-center transition hover:border-[#3559D8] hover:bg-[#f3f5ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559D8]"
    >
      <ImagePlus aria-hidden="true" size={21} className="text-[#3559D8]" />
      <span className="mt-2 text-sm font-semibold text-[#272a31]">{title}</span>
      <span className="mt-1 text-xs text-[#646872]">{hint} · klik atau seret file ke sini</span>
    </button>
  </>
}

export function AdminPanel({ initialConfigured, initialAuthenticated }: { initialConfigured: boolean; initialAuthenticated: boolean }) {
  const [configured, setConfigured] = useState(initialConfigured)
  const [authenticated, setAuthenticated] = useState(initialAuthenticated)
  const [translationAvailable, setTranslationAvailable] = useState(false)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [project, setProject] = useState<AdminProject>(emptyProject)
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [translationBusy, setTranslationBusy] = useState(false)
  const [view, setView] = useState<'projects' | 'content'>('projects')
  const replacementTargetRef = useRef<{ storagePath: string; mediaType: 'cover' | 'gallery' } | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef(new Set<string>())

  useEffect(() => {
    const active = new Set(pendingUploads.map((item) => item.previewUrl))
    for (const url of previewUrls.current) {
      if (!active.has(url)) {
        URL.revokeObjectURL(url)
        previewUrls.current.delete(url)
      }
    }
    for (const url of active) previewUrls.current.add(url)
  }, [pendingUploads])

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  async function loadProjects() {
    const response = await fetch('/api/admin/projects', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Gagal memuat proyek.')
    setProjects(Array.isArray(data.projects) ? data.projects.map(normalizeAdminProject) : [])
  }

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json()
      setConfigured(data.configured === true)
      setTranslationAvailable(data.translationAvailable === true)
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
    setAuthenticated(false); setProjects([]); setProject(emptyProject()); setPendingUploads([]); setEditingSlug(null); setMessage('')
  }

  function editProject(item: AdminProject) {
    const normalized = normalizeAdminProject(item)
    setProject(normalized)
    setPendingUploads([]); setEditingSlug(normalized.slug); setMessage('')
  }

  function startNewProject() {
    setProject(emptyProject()); setPendingUploads([]); setEditingSlug(null); setMessage('')
  }

  function queueFiles(fileList: FileList | null, target: 'cover' | 'gallery', replaceStoragePath?: string) {
    const selection = queueImageFiles({
      current: pendingUploads,
      existingMediaCount: project.media.length,
      existingCoverPath: project.media.find((media) => media.media_type === 'cover')?.storage_path,
      files: fileList,
      target,
      replaceStoragePath,
      createId: () => crypto.randomUUID(),
      createPreview: (file) => URL.createObjectURL(file),
    })
    setPendingUploads(selection.pending)
    setMessage(selection.errors.join(' '))
  }

  function fileInputChanged(event: ChangeEvent<HTMLInputElement>, target: 'cover' | 'gallery', replaceStoragePath?: string) {
    queueFiles(event.target.files, target, replaceStoragePath)
    event.target.value = ''
  }

  function openReplacementPicker(media: Media) {
    replacementTargetRef.current = { storagePath: media.storage_path, mediaType: media.media_type }
    openNativeFilePicker(replacementInputRef.current)
  }

  async function uploadSelectedImages(savedProject: AdminProject, uploads = pendingUploads): Promise<boolean> {
    if (!savedProject.id || !uploads.length || uploadBusy) return false
    setUploadBusy(true)
    setMessage(`Mengunggah ${uploads.length} gambar terpilih…`)
    let nextGalleryOrder = Math.max(-1, ...savedProject.media.filter((media) => media.media_type === 'gallery').map((media) => media.display_order)) + 1
    let currentUploadId: string | undefined
    try {
      for (const item of uploads) {
        currentUploadId = item.id
        setPendingUploads((current) => current.map((pending) => pending.id === item.id ? { ...pending, status: 'uploading' } : pending))
        const existingReplacement = item.replaceStoragePath ? savedProject.media.find((media) => media.storage_path === item.replaceStoragePath) : undefined
        const displayOrder = existingReplacement?.display_order ?? (item.target === 'cover' ? 0 : nextGalleryOrder++)
        const form = new FormData()
        form.set('file', item.file)
        form.set('projectId', savedProject.id)
        form.set('mediaType', item.target)
        form.set('uploadId', item.id)
        form.set('displayOrder', String(displayOrder))
        if (item.replaceStoragePath) form.set('replaceStoragePath', item.replaceStoragePath)
        const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
        const data = await response.json()
        if (!response.ok || !data.media) throw new Error(data.error || `Gagal mengunggah ${item.file.name}.`)
        const uploaded = data.media as Media
        setProject((current) => ({ ...current, media: item.replaceStoragePath
          ? current.media.map((media) => media.storage_path === item.replaceStoragePath ? uploaded : media)
          : [...current.media, uploaded] }))
        setPendingUploads((current) => current.filter((pending) => pending.id !== item.id))
        if (data.warning) setMessage(data.warning)
      }
      setMessage('Semua gambar berhasil diunggah dan metadata-nya tersimpan.')
      await loadProjects().catch(() => setMessage('Gambar dan metadata berhasil diunggah, tetapi daftar proyek gagal diperbarui.'))
      return true
    } catch (error) {
      setPendingUploads((current) => current.map((pending) => pending.id === currentUploadId ? { ...pending, status: 'error' } : pending))
      setMessage(error instanceof Error ? error.message : 'Gagal mengunggah gambar. File yang belum berhasil tetap tersimpan untuk dicoba kembali.')
      return false
    } finally {
      setUploadBusy(false)
    }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const intent = submitter instanceof HTMLButtonElement ? submitter.value : null
    const hasQueuedImages = pendingUploads.length > 0
    const requestedStatus = intent === 'published' ? 'published' : intent === 'unpublish' ? 'draft' : project.status
    const status = hasQueuedImages ? 'draft' : requestedStatus
    const payload = { ...project, status, translations: Object.fromEntries((['id', 'en'] as const).map((locale) => [locale, { ...project.translations[locale], scope: (project.translations?.[locale]?.scope ?? []).flatMap((line) => line.split('\n')).map((line) => line.trim()).filter(Boolean) }])) }
    try {
      const response = await fetch(editingSlug ? `/api/admin/projects/${encodeURIComponent(editingSlug)}` : '/api/admin/projects', { method: editingSlug ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Proyek gagal disimpan.')
      const savedProject = normalizeAdminProject(data.project)
      setProject(savedProject); setEditingSlug(savedProject.slug); await loadProjects()
      if (hasQueuedImages) {
        setMessage('Draf tersimpan. Gambar terpilih akan diunggah sekarang…')
        const uploadsSucceeded = await uploadSelectedImages(data.project, pendingUploads)
        if (requestedStatus === 'published' && uploadsSucceeded) setMessage('Draf dan gambar tersimpan. Periksa media, lalu terbitkan proyek secara terpisah.')
      } else {
        setMessage(data.warning || (payload.status === 'published' ? 'Proyek berhasil diterbitkan.' : 'Draf proyek berhasil disimpan.'))
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Proyek gagal disimpan.') }
    finally { setBusy(false) }
  }

  async function translateToEnglish() {
    const source = toEnglishSource(project.translations.id)
    const current = toEnglishSource(project.translations.en)
    if (!source.title && !source.short_description && !source.description && !source.role && !source.scope.length) {
      setMessage('Isi konten Bahasa Indonesia yang ingin diterjemahkan terlebih dahulu.')
      return
    }
    if (hasEnglishProjectContent(current) && !window.confirm('Konten English yang sudah diisi akan diganti dengan hasil terjemahan. Lanjutkan?')) return
    setTranslationBusy(true); setMessage('Menerjemahkan konten ke English…')
    try {
      const response = await fetch('/api/admin/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Terjemahan gagal.')
      setProject((currentProject) => ({ ...currentProject, translations: { ...currentProject.translations, en: {
        ...currentProject.translations.en,
        ...mergeTranslatedProjectFields(toEnglishSource(currentProject.translations.en), source, data.translations),
      } } }))
      setMessage('Terjemahan English siap ditinjau dan diedit. Simpan proyek untuk menerapkannya.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Terjemahan gagal. Konten Indonesia tetap tidak berubah.') }
    finally { setTranslationBusy(false) }
  }

  async function deleteProject(slug: string) {
    if (!window.confirm(`Hapus proyek “${slug}”?`)) return
    const response = await fetch(`/api/admin/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error || 'Proyek gagal dihapus.')
    await loadProjects(); if (editingSlug === slug) startNewProject()
    setMessage(data.warning || 'Proyek berhasil dihapus.')
  }

  function changeTranslation(locale: Locale, field: keyof Translation, value: string) {
    setProject((current) => ({ ...current, translations: { ...current.translations, [locale]: { ...(current.translations?.[locale] ?? emptyAdminProject().translations[locale]), [field]: field === 'scope' ? value.split('\n') : value } } }))
  }

  function changeMedia(index: number, field: keyof Media, value: string) {
    setProject((current) => ({ ...current, media: current.media.map((media, i) => i === index ? { ...media, [field]: value } : media) }))
  }

  function moveGallery(index: number, direction: -1 | 1) {
    setProject((current) => {
      const galleries = current.media.filter((media) => media.media_type === 'gallery')
      const item = galleries[index]
      const neighbor = galleries[index + direction]
      if (!item || !neighbor) return current
      const next = current.media.map((media) => media === item ? { ...media, display_order: neighbor.display_order } : media === neighbor ? { ...media, display_order: item.display_order } : media)
      return { ...current, media: next }
    })
  }

  function movePendingGallery(id: string, direction: -1 | 1) {
    setPendingUploads((current) => {
      const gallery = current.filter((item) => item.target === 'gallery')
      const from = gallery.findIndex((item) => item.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= gallery.length) return current
      const first = current.findIndex((item) => item.id === gallery[from].id)
      const second = current.findIndex((item) => item.id === gallery[to].id)
      const next = [...current]; [next[first], next[second]] = [next[second], next[first]]
      return next
    })
  }

  function removePending(id: string) { setPendingUploads((current) => current.filter((item) => item.id !== id)) }
  function removeExistingMedia(media: Media) {
    setProject((current) => ({ ...current, media: current.media.filter((item) => item.storage_path !== media.storage_path) }))
    setPendingUploads((current) => current.filter((item) => item.replaceStoragePath !== media.storage_path))
    setMessage('Penghapusan akan diterapkan saat proyek disimpan; objek Storage tidak dihapus sebelum metadata tersimpan.')
  }

  if (!ready) return <main className="mx-auto max-w-6xl px-5 py-20 text-sm text-[#646872]">Memuat panel admin…</main>
  if (!configured) return <main className="mx-auto max-w-xl px-5 py-24"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-4 text-4xl font-semibold">Supabase belum dikonfigurasi</h1><p className="mt-4 leading-7 text-[#646872]">Admin dan perubahan konten dinonaktifkan. Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, jalankan migrasi SQL, lalu buat akun admin dan masukkan UUID-nya ke tabel <code>admin_users</code>.</p></main>
  if (!authenticated) return <main className="mx-auto max-w-md px-5 py-24"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">Masuk admin</h1><p className="mt-3 text-sm leading-6 text-[#646872]">Gunakan akun administrator yang sudah diizinkan oleh pemilik situs.</p><form onSubmit={login} className="mt-8 space-y-4"><label className={labelClass}>Email<input className={fieldClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className={labelClass}>Password<input className={fieldClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={busy} className="w-full rounded-lg bg-[#171717] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Memeriksa…' : 'Masuk'}</button></form>{message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}</main>
  if (view === 'content') return <SiteContentEditor onBack={() => setView('projects')} />

  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dededb] pb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">GENIASTRA · ADMIN</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Kelola proyek</h1><p className="mt-2 text-sm text-[#646872]">Proyek disimpan di Supabase dan tampil di situs setelah diterbitkan.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setView('content')} className="rounded-lg border border-[#dededb] px-4 py-2.5 text-sm">Konten situs</button><button type="button" onClick={startNewProject} className="inline-flex items-center gap-2 rounded-lg bg-[#3559D8] px-4 py-2.5 text-sm font-medium text-white"><Plus size={16}/>Proyek baru</button><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-[#dededb] px-4 py-2.5 text-sm"><LogOut size={16}/>Keluar</button></div></header>
    {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-[#45474d]">{message}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.5fr)]">
      <aside className="space-y-3"><h2 className="text-sm font-semibold">Daftar proyek ({projects.length})</h2>{projects.length ? projects.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-lg border p-3 ${editingSlug === item.slug ? 'border-[#3559D8] bg-white' : 'border-[#dededb]'}`}><button type="button" onClick={() => editProject(item)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{item.translations.en.title || item.translations.id.title || 'Draf tanpa judul'}</span><span className="block truncate text-xs text-[#646872]">{item.status} · /{item.slug}</span></button><button type="button" onClick={() => deleteProject(item.slug)} aria-label={`Hapus ${item.slug}`} className="rounded p-2 text-[#646872] hover:bg-red-50 hover:text-red-700"><Trash2 size={16}/></button></div>) : <p className="rounded-lg border border-dashed border-[#cfcfca] p-4 text-sm text-[#646872]">Belum ada proyek di database Supabase.</p>}</aside>
      <form onSubmit={saveProject} className="space-y-6 rounded-xl border border-[#dededb] bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{editingSlug ? 'Edit proyek' : 'Tambah proyek'}</h2>{editingSlug && <button type="button" onClick={startNewProject} className="text-sm text-[#646872]">Batal edit</button>}</div>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]"><label className={labelClass}>Slug URL<input className={fieldClass} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={project.slug ?? ""} onChange={(event) => setProject({ ...project, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /></label><label className={labelClass}>Kategori<select className={fieldClass} value={project.category ?? ""} onChange={(event) => setProject({ ...project, category: event.target.value })}><option value="website">Website</option><option value="web-application">Web application</option><option value="chatbot">Chatbot</option><option value="other">Lainnya</option></select></label></div>
        <div className="grid gap-5 sm:grid-cols-2">{(['id', 'en'] as const).map((locale) => <section key={locale} className="space-y-3 rounded-lg border border-[#dededb] p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{locale === 'id' ? 'Bahasa Indonesia' : 'English'}</h3>{locale === 'en' && <div className="text-right"><button type="button" disabled={!translationAvailable || translationBusy} onClick={translateToEnglish} className="inline-flex items-center gap-1.5 rounded-md border border-[#dededb] px-2.5 py-1.5 text-xs font-medium text-[#3559D8] disabled:cursor-not-allowed disabled:opacity-50"><Languages size={14}/>{translationBusy ? 'Menerjemahkan…' : 'Translate to English'}</button>{!translationAvailable && <p className="mt-1 max-w-48 text-[11px] font-normal text-[#777b84]">Tambahkan DEEPL_AUTH_KEY di environment server untuk mengaktifkan.</p>}</div>}</div><label className={labelClass}>Judul<input className={fieldClass} value={project.translations?.[locale]?.title ?? ""} onChange={(event) => changeTranslation(locale, 'title', event.target.value)} /></label><label className={labelClass}>Deskripsi singkat<textarea className={fieldClass} rows={2} value={project.translations?.[locale]?.short_description ?? ""} onChange={(event) => changeTranslation(locale, 'short_description', event.target.value)} /></label><label className={labelClass}>Deskripsi lengkap<textarea className={fieldClass} rows={4} value={project.translations?.[locale]?.description ?? ""} onChange={(event) => changeTranslation(locale, 'description', event.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label className={labelClass}>Peran<input className={fieldClass} value={project.translations?.[locale]?.role ?? ""} onChange={(event) => changeTranslation(locale, 'role', event.target.value)} /></label><label className={labelClass}>Periode<input className={fieldClass} value={project.translations?.[locale]?.period_label ?? ""} onChange={(event) => changeTranslation(locale, 'period_label', event.target.value)} /></label></div><label className={labelClass}>Tanda singkat<input className={fieldClass} maxLength={12} value={project.translations?.[locale]?.mark ?? ""} onChange={(event) => changeTranslation(locale, 'mark', event.target.value.toUpperCase())} /></label><label className={labelClass}>Ruang lingkup<textarea className={fieldClass} rows={4} value={(project.translations?.[locale]?.scope ?? []).join('\n')} onChange={(event) => changeTranslation(locale, 'scope', event.target.value)} placeholder="Satu item per baris" /></label><label className={labelClass}>Judul SEO<input className={fieldClass} value={project.translations?.[locale]?.seo_title ?? ""} onChange={(event) => changeTranslation(locale, 'seo_title', event.target.value)} /></label><label className={labelClass}>Deskripsi SEO<textarea className={fieldClass} rows={2} value={project.translations?.[locale]?.seo_description ?? ""} onChange={(event) => changeTranslation(locale, 'seo_description', event.target.value)} /></label></section>)}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Tanggal mulai<input className={fieldClass} type="date" value={project.start_date ?? ""} onChange={(event) => setProject({ ...project, start_date: event.target.value })} /></label><label className={labelClass}>Tanggal selesai<input className={fieldClass} type="date" value={project.end_date ?? ""} onChange={(event) => setProject({ ...project, end_date: event.target.value })} /></label><label className={labelClass}>URL proyek<input className={fieldClass} type="url" value={project.project_url ?? ""} onChange={(event) => setProject({ ...project, project_url: event.target.value })} /></label><label className={labelClass}>URL GitHub<input className={fieldClass} type="url" value={project.github_url ?? ""} onChange={(event) => setProject({ ...project, github_url: event.target.value })} /></label></div>
        <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={project.featured} onChange={(event) => setProject({ ...project, featured: event.target.checked })}/>Proyek pilihan</label><label className="flex items-center gap-2 text-sm">Urutan<input className="w-24 rounded border border-[#dededb] px-2 py-1" type="number" min="0" value={project.display_order ?? 0} onChange={(event) => setProject({ ...project, display_order: Number(event.target.value) })}/></label><span className="text-sm text-[#646872]">Status: {project.status}</span></div>

        <section className="space-y-4 border-t border-[#dededb] pt-5" aria-labelledby="project-media-heading">
          <div><h3 id="project-media-heading" className="font-semibold">Media proyek</h3><p className="mt-1 text-xs text-[#646872]">JPEG, PNG, WebP, AVIF · maksimal 10 MB per file. Pilih dan pratinjau sekarang; unggah setelah draf tersimpan.</p></div>
          <input id="replace-file-input" ref={replacementInputRef} type="file" accept={imageAccept} className="sr-only" aria-label="Pilih gambar pengganti" onChange={(event) => { const target = replacementTargetRef.current; if (target) fileInputChanged(event, target.mediaType, target.storagePath); else event.target.value = ''; replacementTargetRef.current = null }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PickerButton id="cover-picker-button" title="Pilih gambar sampul" hint="Pilih satu gambar" inputId="cover-file-input" inputRef={coverInputRef} onChange={(event) => fileInputChanged(event, 'cover')} onDropFiles={(files) => queueFiles(files, 'cover')} />
            <PickerButton id="gallery-picker-button" title="Tambah gambar galeri" hint="Bisa pilih banyak gambar" inputId="gallery-file-input" multiple inputRef={galleryInputRef} onChange={(event) => fileInputChanged(event, 'gallery')} onDropFiles={(files) => queueFiles(files, 'gallery')} />
          </div>

          {pendingUploads.length > 0 && <div className="space-y-3 rounded-xl border border-[#cfd6ec] bg-[#fafbff] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">File terpilih ({pendingUploads.length})</h4><p className="mt-1 text-xs text-[#646872]">{project.id ? 'Siap diunggah ke Storage.' : 'File tetap dipilih saat draf disimpan; belum ada unggahan.'}</p></div><button type="button" disabled={!project.id || uploadBusy || pendingUploads.length === 0} onClick={() => void uploadSelectedImages(project)} className="rounded-lg bg-[#3559D8] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{uploadBusy ? 'Mengunggah…' : 'Unggah file terpilih'}</button></div>
            <div className="grid gap-3 sm:grid-cols-2">{pendingUploads.map((item) => { const galleryQueue = pendingUploads.filter((pending) => pending.target === 'gallery' && !pending.replaceStoragePath); const galleryPosition = galleryQueue.findIndex((pending) => pending.id === item.id); return <article key={item.id} className="flex min-w-0 gap-3 rounded-lg border border-[#dededb] bg-white p-3"><Image src={item.previewUrl} alt={`Pratinjau ${item.file.name}`} width={88} height={72} unoptimized className="h-[72px] w-[88px] shrink-0 rounded-md object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p><p className="mt-1 text-xs text-[#646872]">{item.target === 'cover' ? 'Sampul' : 'Galeri'} · {formatFileSize(item.file.size)}</p><p className={`mt-1 text-xs ${item.status === 'error' ? 'text-red-700' : 'text-[#646872]'}`}>{item.status === 'uploading' ? 'Sedang diunggah…' : item.status === 'error' ? 'Gagal; pilih unggah lagi untuk mencoba ulang.' : 'Menunggu unggahan'}</p><div className="mt-2 flex gap-1">{item.target === 'gallery' && !item.replaceStoragePath && <><button type="button" aria-label="Naikkan file galeri" disabled={galleryPosition <= 0 || item.status === 'uploading'} onClick={() => movePendingGallery(item.id, -1)} className="rounded p-1 text-[#646872] disabled:opacity-30"><ArrowUp size={14}/></button><button type="button" aria-label="Turunkan file galeri" disabled={galleryPosition < 0 || galleryPosition >= galleryQueue.length - 1 || item.status === 'uploading'} onClick={() => movePendingGallery(item.id, 1)} className="rounded p-1 text-[#646872] disabled:opacity-30"><ArrowDown size={14}/></button></>}<button type="button" disabled={item.status === 'uploading'} onClick={() => removePending(item.id)} aria-label={`Hapus pilihan ${item.file.name}`} className="rounded p-1 text-red-700 disabled:opacity-30"><X size={14}/><span className="sr-only">Hapus pilihan</span></button></div></div></article>})}</div>
          </div>}

          {project.media.length > 0 && <div className="space-y-3"><h4 className="text-sm font-semibold">Gambar tersimpan ({project.media.length})</h4>{project.media.map((media, index) => <div key={media.storage_path} className="grid gap-3 rounded-lg border border-[#dededb] p-4 sm:grid-cols-[100px_1fr_auto]">{media.url ? <Image src={media.url} alt={media.alt_text_id || media.alt_text_en || 'Gambar proyek tersimpan'} width={96} height={80} unoptimized className="h-20 w-24 rounded object-cover"/> : <div className="h-20 w-24 rounded bg-[#f1f1ee]"/>}<div className="grid min-w-0 gap-2 sm:grid-cols-2"><p className="col-span-full truncate text-xs text-[#646872]">{media.media_type === 'cover' ? 'Sampul' : `Galeri ${media.display_order + 1}`}: {media.storage_path}</p><input className={fieldClass} aria-label="Alt Indonesia" placeholder="Alt Indonesia" value={media.alt_text_id ?? ""} onChange={(event) => changeMedia(index, 'alt_text_id', event.target.value)}/><input className={fieldClass} aria-label="Alt English" placeholder="Alt English" value={media.alt_text_en ?? ""} onChange={(event) => changeMedia(index, 'alt_text_en', event.target.value)}/><input className={fieldClass} aria-label="Caption Indonesia" placeholder="Caption Indonesia" value={media.caption_id ?? ""} onChange={(event) => changeMedia(index, 'caption_id', event.target.value)}/><input className={fieldClass} aria-label="Caption English" placeholder="Caption English" value={media.caption_en ?? ""} onChange={(event) => changeMedia(index, 'caption_en', event.target.value)}/></div><div className="flex items-center gap-1"><button type="button" onClick={() => openReplacementPicker(media)} aria-label={`Ganti ${media.media_type === 'cover' ? 'sampul' : 'gambar galeri'}`} className="rounded p-2 text-[#3559D8]"><Replace size={16}/></button><button type="button" disabled={media.media_type === 'cover'} onClick={() => moveGallery(project.media.filter((item) => item.media_type === 'gallery').findIndex((item) => item.storage_path === media.storage_path), -1)} aria-label="Naikkan urutan" className="rounded p-2 disabled:opacity-30"><ArrowUp size={16}/></button><button type="button" disabled={media.media_type === 'cover'} onClick={() => moveGallery(project.media.filter((item) => item.media_type === 'gallery').findIndex((item) => item.storage_path === media.storage_path), 1)} aria-label="Turunkan urutan" className="rounded p-2 disabled:opacity-30"><ArrowDown size={16}/></button><button type="button" onClick={() => removeExistingMedia(media)} aria-label="Hapus gambar" className="rounded p-2 text-red-700"><Trash2 size={16}/></button></div></div>)}</div>}
        </section>

        <div className="flex flex-wrap gap-3 border-t border-[#dededb] pt-5"><button type="submit" disabled={busy || uploadBusy} value="draft" className="inline-flex items-center gap-2 rounded-lg border border-[#dededb] px-5 py-3 text-sm font-medium disabled:opacity-50"><Save size={16}/>{busy ? 'Menyimpan…' : 'Simpan draf'}</button><button type="submit" disabled={busy || uploadBusy} value="published" className="rounded-lg bg-[#3559D8] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">Terbitkan</button>{project.status === 'published' && <button type="submit" disabled={busy || uploadBusy} value="unpublish" className="rounded-lg border border-[#dededb] px-5 py-3 text-sm">Jadikan draf</button>}</div>
      </form>
    </div>
  </main>
}
