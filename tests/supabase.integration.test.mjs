import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_TEST_URL
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY
const configured = Boolean(url && key)
const publicClient = configured ? createClient(url, key, { auth: { persistSession: false } }) : null
const remoteSkip = !configured && 'Set SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY to run remote integration tests.'

test('public reads expose only published project rows', { skip: remoteSkip }, async () => {
  const { data, error } = await publicClient.from('projects').select('status')
  assert.ifError(error)
  assert.ok((data ?? []).every((project) => project.status === 'published'))
})

test('anonymous project mutations and image uploads are rejected', { skip: remoteSkip }, async () => {
  const { error: projectError } = await publicClient.from('projects').insert({ slug: `anon-test-${Date.now()}` })
  assert.ok(projectError, 'anonymous project insert must be denied by RLS')
  const { error: uploadError } = await publicClient.storage.from('portfolio-media').upload(`projects/00000000-0000-4000-8000-000000000000/${crypto.randomUUID()}.png`, new Uint8Array([1, 2, 3]), { contentType: 'image/png' })
  assert.ok(uploadError, 'anonymous storage upload must be denied')
})

const adminEmail = process.env.SUPABASE_TEST_ADMIN_EMAIL
const adminPassword = process.env.SUPABASE_TEST_ADMIN_PASSWORD
test('approved administrator can authenticate and read its allowlist row', { skip: !configured || !adminEmail || !adminPassword }, async () => {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  assert.ifError(authError)
  assert.ok(auth.user)
  const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', auth.user.id).eq('is_active', true).single()
  assert.ifError(error)
  assert.equal(data.user_id, auth.user.id)
  await client.auth.signOut()
})

const nonAdminEmail = process.env.SUPABASE_TEST_NONADMIN_EMAIL
const nonAdminPassword = process.env.SUPABASE_TEST_NONADMIN_PASSWORD
test('authenticated non-admin cannot mutate project rows', { skip: !configured || !nonAdminEmail || !nonAdminPassword }, async () => {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { error: authError } = await client.auth.signInWithPassword({ email: nonAdminEmail, password: nonAdminPassword })
  assert.ifError(authError)
  const { error } = await client.from('projects').insert({ slug: `nonadmin-test-${crypto.randomUUID()}` })
  assert.ok(error, 'non-admin project insert must be denied by RLS')
  await client.auth.signOut()
})
