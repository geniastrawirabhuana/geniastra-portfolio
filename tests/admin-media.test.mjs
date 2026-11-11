import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createImageStoragePath,
  formatFileSize,
  imageExtensionForBytes,
  MAX_IMAGE_SIZE,
  openNativeFilePicker,
  queueImageFiles,
  uploadAndPersistImage,
  validateImageFile,
} from '../lib/admin-media.ts'

const projectId = '123e4567-e89b-42d3-a456-426614174000'
const fakeFile = (name, type = 'image/png', size = 1024) => ({ name, type, size })
const picker = (options = {}) => ({
  current: 0,
  ...options,
  click() { this.current += 1 },
})
const queue = (options = {}) => queueImageFiles({
  current: [], existingMediaCount: 0, files: [], target: 'cover',
  createId: (() => { let id = 0; return () => `upload-${++id}` })(),
  createPreview: (file) => `blob:${file.name}`,
  ...options,
})

test('visible picker handler clicks synchronously and safely handles a missing input', () => {
  const input = picker()
  openNativeFilePicker(input)
  assert.equal(input.current, 1)
  assert.doesNotThrow(() => openNativeFilePicker(null))
})

test('cover can be selected for an unsaved draft and previews its filename', () => {
  const file = fakeFile('cover.png')
  const result = queue({ files: [file], target: 'cover' })
  assert.equal(result.pending.length, 1)
  assert.equal(result.pending[0].file.name, 'cover.png')
  assert.equal(result.pending[0].previewUrl, 'blob:cover.png')
  assert.equal(result.pending[0].status, 'queued')
})

test('gallery queues multiple files and keeps deterministic user order', () => {
  const result = queue({ files: [fakeFile('one.webp', 'image/webp'), fakeFile('two.avif', 'image/avif')], target: 'gallery' })
  assert.deepEqual(result.pending.map((item) => item.file.name), ['one.webp', 'two.avif'])
  assert.deepEqual(result.pending.map((item) => item.previewUrl), ['blob:one.webp', 'blob:two.avif'])
})

test('canceling selection preserves previously queued images', () => {
  const queued = queue({ files: [fakeFile('keep.png')], target: 'cover' }).pending
  const result = queue({ current: queued, files: null, target: 'cover' })
  assert.equal(result.pending, queued)
  assert.equal(result.pending[0].file.name, 'keep.png')
})

test('selecting another cover replaces the queued selection and existing cover previews', () => {
  const first = queue({ files: [fakeFile('old.png')], target: 'cover' }).pending
  const second = queue({ current: first, existingMediaCount: 1, existingCoverPath: `projects/${projectId}/old.png`, files: [fakeFile('new.png')], target: 'cover' })
  assert.equal(second.pending.length, 1)
  assert.equal(second.pending[0].file.name, 'new.png')
  assert.equal(second.pending[0].replaceStoragePath, `projects/${projectId}/old.png`)
})

test('replacing an existing cover keeps the cover media type and stable target path', () => {
  const result = queue({ files: [fakeFile('replacement.png')], target: 'cover', replaceStoragePath: `projects/${projectId}/old-cover.png` })
  assert.equal(result.pending[0].target, 'cover')
  assert.equal(result.pending[0].replaceStoragePath, `projects/${projectId}/old-cover.png`)
})

test('gallery queue enforces file type, 10 MB limit, and the 13-image cap', () => {
  const result = queue({
    existingMediaCount: 12,
    files: [fakeFile('ok.jpg', 'image/jpeg'), fakeFile('too-large.png', 'image/png', MAX_IMAGE_SIZE + 1), fakeFile('bad.gif', 'image/gif')],
    target: 'gallery',
  })
  assert.equal(result.pending.length, 1)
  assert.equal(result.errors.length, 2)
  assert.equal(validateImageFile(fakeFile('limit.png', 'image/png', MAX_IMAGE_SIZE)), null)
  assert.match(validateImageFile(fakeFile('large.png', 'image/png', MAX_IMAGE_SIZE + 1)), /maksimal 10 MB/)
  assert.match(validateImageFile(fakeFile('bad.gif', 'image/gif')), /format yang didukung/)
})

test('validated image signatures map to safe extensions and reject mismatched MIME', () => {
  assert.equal(imageExtensionForBytes('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff])), 'jpg')
  assert.equal(imageExtensionForBytes('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), 'png')
  assert.equal(imageExtensionForBytes('image/webp', Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), 'webp')
  assert.equal(imageExtensionForBytes('image/avif', new TextEncoder().encode('xxxxftypavif')), 'avif')
  assert.equal(imageExtensionForBytes('image/png', new TextEncoder().encode('not a png')), undefined)
  assert.equal(imageExtensionForBytes('image/gif', new Uint8Array([1, 2, 3])), undefined)
})

test('upload path stays stable for retries using the same project and upload IDs', () => {
  const uploadId = '123e4567-e89b-42d3-a456-426614174001'
  assert.equal(createImageStoragePath(projectId, uploadId, 'webp'), createImageStoragePath(projectId, uploadId, 'webp'))
  assert.equal(createImageStoragePath(projectId, uploadId, 'webp'), `projects/${projectId}/${uploadId}.webp`)
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB')
})

test('Storage failure never attempts to create database metadata', async () => {
  let persisted = false
  await assert.rejects(uploadAndPersistImage({
    storagePath: 'new.png',
    upload: async () => { throw new Error('storage failed') },
    persistMetadata: async () => { persisted = true },
    removeNewObject: async () => {},
  }), /storage failed/)
  assert.equal(persisted, false)
})

test('metadata failure removes the newly uploaded object', async () => {
  const calls = []
  await assert.rejects(uploadAndPersistImage({
    storagePath: 'new.png',
    upload: async () => calls.push('upload'),
    persistMetadata: async () => { calls.push('metadata'); throw new Error('database unavailable') },
    removeNewObject: async () => calls.push('remove-new'),
  }), /objek baru berhasil dibersihkan/)
  assert.deepEqual(calls, ['upload', 'metadata', 'remove-new'])
})

test('metadata failure reports the orphan path if safe cleanup also fails', async () => {
  await assert.rejects(uploadAndPersistImage({
    storagePath: 'projects/a/new.png',
    upload: async () => {},
    persistMetadata: async () => { throw new Error('database unavailable') },
    removeNewObject: async () => { throw new Error('RLS denied') },
  }), (error) => error.orphanedStoragePath === 'projects/a/new.png' && /Storage/.test(error.message))
})

test('replaced Storage object is removed only after new metadata is saved', async () => {
  const calls = []
  const result = await uploadAndPersistImage({
    storagePath: 'new.png', replacedStoragePath: 'old.png',
    upload: async () => calls.push('upload'),
    persistMetadata: async () => { calls.push('metadata'); return { id: 'saved' } },
    removeNewObject: async () => calls.push('remove-new'),
    removeReplacedObject: async () => calls.push('remove-old'),
  })
  assert.deepEqual(calls, ['upload', 'metadata', 'remove-old'])
  assert.deepEqual(result, { record: { id: 'saved' } })
})

test('replacement cleanup failure keeps saved metadata and returns a warning', async () => {
  const result = await uploadAndPersistImage({
    storagePath: 'new.png', replacedStoragePath: 'old.png',
    upload: async () => {}, persistMetadata: async () => ({ id: 'saved' }),
    removeNewObject: async () => {}, removeReplacedObject: async () => { throw new Error('Storage unavailable') },
  })
  assert.equal(result.record.id, 'saved')
  assert.match(result.warning, /old.png/)
})
