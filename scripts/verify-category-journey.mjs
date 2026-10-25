import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { readFileSync, readdirSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local', quiet: true })
const databaseSource = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(databaseSource.hostname)) throw new Error('Local PostgreSQL required')
if (!existsSync('.next-e2e/standalone/server.js')) throw new Error('Build the current revision with scripts/next-build.mjs .next-e2e first')
const journeySuite = process.argv[2] ?? 'e2e/category-recheck.spec.ts'
if (!['e2e/category-recheck.spec.ts', 'e2e/customer-reliability.spec.ts', 'e2e/public-journeys.spec.ts'].includes(journeySuite)) throw new Error('Choose a supported local customer journey')
const appPort = Number(process.env.FIXFLAGS_LOCAL_APP_PORT ?? 3145)
const fixturePort = Number(process.env.FIXFLAGS_LOCAL_FIXTURE_PORT ?? 3146)
if (![appPort, fixturePort].every(port => Number.isInteger(port) && port > 1024 && port < 65536) || appPort === fixturePort) throw new Error('Choose two distinct local verification ports')
const appOrigin = `http://127.0.0.1:${appPort}`
for (const port of [appPort, fixturePort]) {
  const probe = createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve) })
  await new Promise(resolve => probe.close(resolve))
}
const suffix = randomUUID().replaceAll('-', '')
const databaseName = 'fixflags_category_journey_' + suffix
const redisName = 'fixflags-category-journey-' + suffix
const disposable = new URL(databaseSource); disposable.pathname = '/' + databaseName; disposable.search = ''
const output = '.agents/artifacts/scan-completion/category-runtime-' + suffix
mkdirSync(output, { recursive: true })
const runtimeLog = openSync(output + '/runtime.log', 'w')
const admin = new PrismaClient()
function treeFingerprint(roots) {
  const hash = createHash('sha256')
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = directory + '/' + entry.name
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) { hash.update(path); hash.update(readFileSync(path)) }
    }
  }
  roots.forEach(visit)
  return hash.digest('hex')
}
let created = false, redisCreated = false, runtime
const receipt = { environment: 'isolated local production app and real worker; controlled transports, no external acceptance',
  appBuildId: readFileSync('.next-e2e/BUILD_ID', 'utf8').trim(),
  appBundleSha256: treeFingerprint(['.next-e2e/server', '.next-e2e/static']),
  journeySuite, status: 'running', startedAt: new Date().toISOString() }
function run(command, args, env = process.env, timeout = 300_000) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout })
  if (result.status !== 0) throw new Error([result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n') || 'Verification process failed')
  return result.stdout.trim()
}
try {
  receipt.gitHead = run('git', ['rev-parse', 'HEAD'])
  receipt.workerSourceSha256 = treeFingerprint(['lib', 'worker'])
  receipt.schemaSha256 = createHash('sha256').update(readFileSync('prisma/schema.prisma')).digest('hex')
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`); created = true
  const env = { ...process.env, DATABASE_URL: disposable.toString() }
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env)
  receipt.migrations = run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'status'], env)
  receipt.drift = run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], env)
  run('docker', ['run', '--detach', '--name', redisName, '--publish', '127.0.0.1::6379', 'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no']); redisCreated = true
  const port = run('docker', ['port', redisName, '6379/tcp']).split(':').at(-1)
  Object.assign(env, { REDIS_URL: `redis://127.0.0.1:${port}`, FIXFLAGS_LOCAL_RELIABILITY_PROOF: '1', FIXFLAGS_LOCAL_PROVIDER_REFUSAL: '1',
    NEXT_PUBLIC_APP_URL: appOrigin, BETTER_AUTH_URL: appOrigin, FIXFLAGS_LOCAL_APP_PORT: String(appPort), FIXFLAGS_LOCAL_FIXTURE_PORT: String(fixturePort), BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    TOKEN_ENCRYPTION_KEY: '11'.repeat(32), OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', PAGESPEED_API_KEY: '',
    R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', RESEND_API_KEY: '' })
  run(process.execPath, ['scripts/build-worker.mjs'], env)
  receipt.parserBundleSha256 = createHash('sha256').update(readFileSync('dist/worker/check-parser.js')).digest('hex')
  runtime = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'e2e/support/customer-reliability-runtime.ts'], { env, stdio: ['ignore', runtimeLog, runtimeLog] })
  const deadline = Date.now() + 60_000
  while (true) {
    if (runtime.exitCode !== null) throw new Error('Fixture runtime failed. Inspect its local log.')
    if (Date.now() >= deadline) throw new Error('Fixture runtime did not become ready.')
    const response = await fetch(`${appOrigin}/sign-in`).catch(() => null)
    if (response?.ok) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (journeySuite === 'e2e/public-journeys.spec.ts') {
    const fixture = JSON.parse(readFileSync('.cache/customer-reliability-runtime.json', 'utf8'))
    const configured = await fetch(`${fixture.fixtureOrigin}/control`, {
      method: 'POST', headers: { authorization: `Bearer ${fixture.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fixtureEnabled: true, broken: false }), signal: AbortSignal.timeout(10_000),
    })
    if (!configured.ok) throw new Error('Could not prepare this isolated public website fixture')
    env.E2E_FULL = 'true'
    env.E2E_AUDIT_URL = `https://example.com${fixture.prefix}`
  }
  console.log(`Isolated runtime ready. Running ${journeySuite}.`)
  // The recovery spec already owns a 15-minute deadline and observes real delivery backoff.
  const result = run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', journeySuite, '--project=chromium',
    ...(journeySuite === 'e2e/public-journeys.spec.ts' ? ['--grep', 'anonymous check reaches a Site board without exposing fix prompts$'] : []),
  ], { ...env, E2E_BASE_URL: appOrigin }, journeySuite === 'e2e/customer-reliability.spec.ts' ? 960_000 : 300_000)
  writeFileSync(output + '/playwright.log', result + '\n')
  console.log(result)
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'
  if (created) {
    const diagnosis = new PrismaClient({ datasourceUrl: disposable.toString() })
    try { receipt.tasks = await diagnosis.auditVerifierExecution.findMany({
      where: { workKind: { not: null } }, select: { targetKey: true, workKind: true, workState: true, workAttempts: true, workErrorCode: true, workRetryAt: true, workLeaseUntil: true },
    }) } finally { await diagnosis.$disconnect() }
  }
  receipt.error = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  receipt.finishedAt = new Date().toISOString()
  writeFileSync(output + '/receipt.json', JSON.stringify(receipt, null, 2))
  if (runtime?.exitCode === null) { const stopped = once(runtime, 'exit'); runtime.kill('SIGTERM'); await stopped }
  closeSync(runtimeLog)
  if (redisCreated) run('docker', ['rm', '--force', redisName])
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
  await admin.$disconnect()
}
