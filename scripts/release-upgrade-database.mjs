import { randomUUID, createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
const previous = process.env.RELEASE_PREVIOUS_COMMIT
if (!/^[a-f0-9]{40}$/.test(previous ?? '')) throw new Error('RELEASE_PREVIOUS_COMMIT must identify the previous deployed schema')
const source = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(source.hostname)) throw new Error('Upgrade proof requires isolated local PostgreSQL')
const name = 'fixflags_upgrade_test_' + randomUUID().replaceAll('-', '')
const url = new URL(source); url.pathname = '/' + name; url.search = ''
const directory = mkdtempSync(path.join(tmpdir(), 'fixflags-upgrade-'))
const admin = new PrismaClient(), db = new PrismaClient({ datasourceUrl: url.href })
let created = false
const git = args => execFileSync('git', args, { encoding: 'utf8' })
const run = args => {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    env: { ...process.env, DATABASE_URL: url.href }, encoding: 'utf8', timeout: 120_000,
  })
  if (result.status !== 0) throw new Error('Upgrade migration command failed: ' + (result.stderr || result.stdout).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED]'))
}
try {
  const files = git(['ls-tree', '-r', '--name-only', previous, '--', 'prisma/migrations']).trim().split('\n').filter(Boolean)
  if (!files.length) throw new Error('Previous revision has no migration history')
  writeFileSync(path.join(directory, 'schema.prisma'), git(['show', previous + ':prisma/schema.prisma']))
  for (const file of files) {
    const destination = path.join(directory, file.replace('prisma/', ''))
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, git(['show', previous + ':' + file]))
  }
  const previousConfig = path.join(directory, 'previous.config.ts')
  const configModule = createRequire(import.meta.url).resolve('prisma/config')
  writeFileSync(previousConfig, `import { defineConfig } from ${JSON.stringify(configModule)}; export default defineConfig(${JSON.stringify({
    schema: path.join(directory, 'schema.prisma'), migrations: { path: path.join(directory, 'migrations') },
  })});`)
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`); created = true
  run(['migrate', 'deploy', '--config', previousConfig])
  const previousNames = files.filter(file => file.endsWith('/migration.sql')).map(file => file.split('/').at(-2)).sort()
  const ledger = await db.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`
  if (JSON.stringify(ledger.map(row => row.migration_name)) !== JSON.stringify(previousNames)) throw new Error('Previous migration ledger does not match its exact revision')
  const user = await db.user.create({ data: { email: 'upgrade-' + name + '@example.test', name: 'Upgrade proof', plan: 'BUILDER',
    subscriptionStatus: 'ACTIVE', stripeCustomerId: 'cus_' + name, stripeSubscriptionId: 'sub_' + name }, select: { id: true } })
  const site = await db.project.create({ data: { userId: user.id, name: 'Retained website', url: 'https://example.test/supplied-path',
    canonicalHost: 'example.test', watchInterval: 'WEEKLY', watchNextRunAt: new Date('2026-10-19T12:00:00Z') }, select: { id: true } })
  const audit = await db.audit.create({ data: { userId: user.id, projectId: site.id, url: 'https://example.test/supplied-path', status: 'COMPLETED',
    isPublic: false, completedAt: new Date(), htmlMetadata: { retainedEvidenceReference: 'private-retained-capture' } }, select: { id: true } })
  const outcomeId = 'upgrade-outcome-' + randomUUID(), bindingId = 'upgrade-binding-' + randomUUID()
  await db.$executeRaw`INSERT INTO site_outcomes (id, "projectId", name, slug, kind, "confirmedAt", "updatedAt")
    VALUES (${outcomeId}, ${site.id}, 'Retained page agreement', 'retained-page', 'AVAILABILITY', clock_timestamp(), clock_timestamp())`
  await db.$executeRaw`INSERT INTO outcome_execution_bindings (id, "outcomeId", key, mechanism, config, version, "updatedAt")
    VALUES (${bindingId}, ${outcomeId}, 'retained-http', 'HTTP_AVAILABILITY',
      ${JSON.stringify({ startUrl: 'https://example.test/supplied-path', expectedSelector: 'body' })}::jsonb, 3, clock_timestamp())`
  async function retained() {
    return {
      user: await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true } }),
      site: await db.project.findUniqueOrThrow({ where: { id: site.id }, select: { id: true, userId: true, url: true, canonicalHost: true, watchInterval: true, watchNextRunAt: true } }),
      audit: await db.audit.findUniqueOrThrow({ where: { id: audit.id }, select: { id: true, projectId: true, userId: true, status: true, isPublic: true, htmlMetadata: true } }),
      outcome: await db.$queryRaw`SELECT id, "projectId", kind, "confirmedAt" FROM site_outcomes WHERE id = ${outcomeId}`,
      binding: await db.$queryRaw`SELECT id, "outcomeId", key, mechanism, config, scope, version, enabled FROM outcome_execution_bindings WHERE id = ${bindingId}`,
    }
  }
  const before = JSON.stringify(await retained())
  run(['migrate', 'deploy', '--schema', 'prisma/schema.prisma'])
  run(['migrate', 'status', '--schema', 'prisma/schema.prisma'])
  run(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'])
  if (JSON.stringify(await retained()) !== before) throw new Error('Upgrade changed subscription, Site, history or private evidence identity')
  const permissions = await db.$queryRaw`SELECT "authorizationRevision" FROM site_outcomes WHERE id = ${outcomeId}`
  if (permissions[0]?.authorizationRevision !== 1) throw new Error('Upgrade did not establish the retained authorization baseline')
  const evidence = { schemaVersion: 1, status: 'PASS', gitSha: git(['rev-parse', 'HEAD']).trim(), previousGitSha: previous,
    completedAt: new Date().toISOString(), checks: ['previous migrations applied', 'retained subscription and Site identity',
      'retained historical private evidence reference', 'retained check definition and initial authorization revision',
      'current migrations applied', 'migration ledger current', 'schema drift absent'],
    retainedRecordsSha256: createHash('sha256').update(before).digest('hex') }
  if (process.env.RELEASE_UPGRADE_EVIDENCE_FILE) {
    mkdirSync(path.dirname(process.env.RELEASE_UPGRADE_EVIDENCE_FILE), { recursive: true, mode: 0o700 })
    writeFileSync(process.env.RELEASE_UPGRADE_EVIDENCE_FILE, JSON.stringify(evidence, null, 2), { mode: 0o600 })
  }
  console.log('Upgrade proof passed from ' + previous.slice(0, 8) + ': subscriptions, Site identity, history and private evidence references preserved.')
} finally {
  await db.$disconnect()
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`)
  await admin.$disconnect()
  rmSync(directory, { recursive: true, force: true })
}
