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
for (const port of [3145, 3146]) {
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
  status: 'running', startedAt: new Date().toISOString() }
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 300_000 })
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
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3145', BETTER_AUTH_URL: 'http://127.0.0.1:3145', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    TOKEN_ENCRYPTION_KEY: '11'.repeat(32), OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', PAGESPEED_API_KEY: '',
    R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', RESEND_API_KEY: '' })
  runtime = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'e2e/support/customer-reliability-runtime.ts'], { env, stdio: ['ignore', runtimeLog, runtimeLog] })
  const deadline = Date.now() + 60_000
  while (true) {
    if (runtime.exitCode !== null) throw new Error('Fixture runtime failed. Inspect its local log.')
    if (Date.now() >= deadline) throw new Error('Fixture runtime did not become ready.')
    const response = await fetch('http://127.0.0.1:3145/sign-in').catch(() => null)
    if (response?.ok) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  console.log('Isolated runtime ready. Running the browser category journey.')
  const result = run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'e2e/category-recheck.spec.ts', '--project=chromium'], { ...env, E2E_BASE_URL: 'http://127.0.0.1:3145' })
  writeFileSync(output + '/playwright.log', result + '\n')
  console.log(result)
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'
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
