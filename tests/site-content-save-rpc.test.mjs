import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202611130002_fix_site_content_save_rpc.sql'), 'utf8')
const functionMatch = migration.match(/create\s+or\s+replace\s+function\s+public\.save_site_content_bundle\s*\(([\s\S]*?)\)\s*returns\s+(\w+)([\s\S]*?)as\s+\$\$([\s\S]*?)\$\$\s*;/i)
assert.ok(functionMatch, 'migration must define the existing site-content RPC')
const args = functionMatch[1]
const returnType = functionMatch[2]
const attributes = functionMatch[3]
const body = functionMatch[4]

test('retains the existing RPC signature, return type, security mode, and search_path', () => {
  assert.match(args, /p_settings\s+jsonb\s*,\s*p_values\s+jsonb\s*,\s*p_education\s+jsonb\s*,\s*p_organizations\s+jsonb/i)
  assert.equal(returnType.toLowerCase(), 'void')
  assert.match(attributes, /language\s+plpgsql/i)
  assert.match(attributes, /security\s+invoker/i)
  assert.match(attributes, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth/i)
  assert.match(migration, /revoke all on function public\.save_site_content_bundle\(jsonb, jsonb, jsonb, jsonb\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.save_site_content_bundle\(jsonb, jsonb, jsonb, jsonb\) to authenticated/i)
})

test('checks the active administrator before any RPC data write', () => {
  const check = body.indexOf("if not public.is_portfolio_admin()")
  const firstWrite = body.search(/\b(insert|delete|update)\s+into?\s+public\./i)
  assert.ok(check >= 0 && firstWrite > check)
  assert.match(body, /raise exception 'Administrator access required\.'/)
})

test('saves site settings including cvUrl and localized site content in the RPC', () => {
  assert.match(body, /insert into public\.site_settings[\s\S]*?jsonb_each_text\(coalesce\(p_settings, '\{\}'::jsonb\)\)/i)
  const siteContent = fs.readFileSync(path.join(root, 'lib/site-content.ts'), 'utf8')
  assert.match(siteContent, /cvUrl:\s*content\.contact\.cvUrl/)
  assert.match(siteContent, /p_settings:\s*settings/)
  assert.match(body, /insert into public\.site_content[\s\S]*?jsonb_to_recordset\(coalesce\(p_values/i)
})

test('replace-all education deletion uses an explicit predicate and reinserts submitted entries', () => {
  assert.match(body, /delete from public\.education\s+where\s+true\s*;/i)
  assert.match(body, /jsonb_array_elements\(coalesce\(p_education, '\[\]'::jsonb\)\)/i)
  assert.match(body, /insert into public\.education\s*\(title, detail_id, detail_en, period_label, display_order, is_published\)/i)
})

test('organization replacement remains scoped and reinserts translations', () => {
  assert.match(body, /delete from public\.experiences\s+where\s+kind\s*=\s*'organization'\s*;/i)
  assert.match(body, /jsonb_array_elements\(coalesce\(p_organizations, '\[\]'::jsonb\)\)/i)
  assert.match(body, /insert into public\.experiences\s*\(kind, display_order, period_label, is_published\)/i)
  assert.match(body, /insert into public\.experience_translations\s*\(experience_id, locale, title, description\)/i)
})

test('all replacement writes stay in one uncaught PostgreSQL RPC transaction', () => {
  assert.match(body, /insert into public\.site_settings/i)
  assert.match(body, /insert into public\.site_content/i)
  assert.match(body, /delete from public\.education where true/i)
  assert.match(body, /delete from public\.experiences where kind = 'organization'/i)
  assert.doesNotMatch(body, /\b(commit|rollback)\s*;/i)
  assert.doesNotMatch(body, /exception\s+when/i)
  assert.equal((migration.match(/create\s+or\s+replace\s+function/gi) ?? []).length, 1)
})

test('migration changes only the RPC definition and its execute grants', () => {
  const outsideFunction = migration.replace(functionMatch[0], '')
  assert.doesNotMatch(outsideFunction, /\b(create|alter|drop)\s+table\b|\b(insert|update|delete|truncate)\s+(into\s+)?public\./i)
  assert.doesNotMatch(migration, /admin_users|storage\.buckets|storage\.objects|portfolio-media/i)
  const deletes = [...body.matchAll(/delete\s+from\s+([\w.]+)([^;]*);/gi)]
  assert.equal(deletes.length, 2)
  assert.ok(deletes.every((match) => /\bwhere\b/i.test(match[2])))
})
