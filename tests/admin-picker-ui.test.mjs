import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8')

test('cover and gallery pickers have unique, enabled native file inputs and semantic buttons', () => {
  const ids = [...source.matchAll(/inputId="(cover-file-input|gallery-file-input)"/g)].map((match) => match[1])
  ids.push(...[...source.matchAll(/id="(replace-file-input)"/g)].map((match) => match[1]))
  assert.deepEqual(ids.sort(), ['cover-file-input', 'gallery-file-input', 'replace-file-input'].sort())
  assert.match(source, /<PickerButton id="cover-picker-button"/)
  assert.match(source, /id=\{id\}[\s\S]*?type="button"[\s\S]*?onClick=\{\(\) => openNativeFilePicker\(inputRef\.current\)\}/)
  assert.match(source, /inputId="cover-file-input"/)
  assert.match(source, /inputId="gallery-file-input" multiple/)
  assert.match(source, /<input id=\{inputId\}[^>]*className="sr-only"[^>]*aria-label=\{title\}/)
  assert.doesNotMatch(source, /id=\{inputId\}[^>]*disabled/)
})

test('file picker controls are not submit buttons and support drag and drop', () => {
  assert.match(source, /type="button"\s+aria-controls=\{inputId\}/)
  assert.match(source, /onDragOver=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.match(source, /onDrop=\{drop\}/)
  assert.match(source, /multiple=\{multiple\}/)
})

test('replacement, remove, and pending uploads are separate from saved-project ID', () => {
  assert.match(source, /openReplacementPicker\(media\)/)
  assert.match(source, /removePending\(item\.id\)/)
  assert.match(source, /project\.id \? 'Siap diunggah ke Storage\.' : 'File tetap dipilih saat draf disimpan;/)
})

test('nullable project fields use safe controlled values in the admin form', () => {
  for (const field of ['title', 'short_description', 'description', 'role', 'period_label', 'mark', 'seo_title', 'seo_description']) {
    assert.ok(source.includes(`value={project.translations?.[locale]?.${field} ?? ""}`), `${field} should fall back to an empty string`)
  }
  assert.ok(source.includes("value={(project.translations?.[locale]?.scope ?? []).join('\\n')}"))
  for (const field of ['start_date', 'end_date', 'project_url', 'github_url']) {
    assert.ok(source.includes(`value={project.${field} ?? ""}`), `${field} should fall back to an empty string`)
  }
  for (const field of ['alt_text_id', 'alt_text_en', 'caption_id', 'caption_en']) {
    assert.ok(source.includes(`value={media.${field} ?? ""}`), `${field} should fall back to an empty string`)
  }
})

test('admin labels and workflow controls are readable and retain picker and publish actions', () => {
  for (const label of [
    'Bahasa Indonesia', 'English', 'Tanda singkat', 'Deskripsi lengkap',
    'Translate to English', 'JPEG, PNG, WebP, AVIF', 'Simpan draf', 'Terbitkan',
    'Hapus proyek', 'klik atau seret file ke sini',
  ]) assert.ok(source.includes(label), `Expected readable UI label: ${label}`)
  for (const id of ['cover-picker-button', 'gallery-picker-button']) assert.ok(source.includes(id))
  const knownCorruption = [
    String.fromCodePoint(0x00c3, 0x0192),
    String.fromCodePoint(0x00c3, 0x00a2),
    String.fromCodePoint(0xfffd),
  ]
  for (const marker of knownCorruption) assert.ok(!source.includes(marker), 'Admin text should not contain corrupted encoding markers')
})
