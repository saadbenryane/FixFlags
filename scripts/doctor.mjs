import { loadRuntimeEnvironment } from '../lib/runtime/environment.mjs'
import { localReadiness } from '../lib/runtime/readiness.mjs'
import { readRuntimeState, requestRuntimeControl } from './local-runtime-control.mjs'
import { access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import IORedis from 'ioredis'

loadRuntimeEnvironment()
const results = []
const PLACEHOLDER_CREDENTIAL =
  /(?:place(?:holder)?|change[-_ ]?me|your[-_ ]?(?:api[-_ ]?)?key|example|dummy|fake|\.\.\.)/i

function hasUsableCredential(value) {
  return Boolean(value && value.length >= 20 && !PLACEHOLDER_CREDENTIAL.test(value))
}

const check = async (name, run) => {
  try {
    const detail = await run()
    results.push({ name, ok: true, detail })
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

await check('environment', async () => {
  const required = ['DATABASE_URL', 'REDIS_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}`)
  return 'required runtime values configured'
})

// Capabilities are not runtime prerequisites. Keep their absence visible, while
// allowing independent public checks to run. Release readiness remains strict.
if (
    !hasUsableCredential(process.env.OPENAI_API_KEY) &&
    !hasUsableCredential(process.env.OPEN_CODE_API_KEY) &&
    !hasUsableCredential(process.env.OPENCODE_API_KEY) &&
    !hasUsableCredential(process.env.ANTHROPIC_API_KEY)
  ) results.push({ name: 'AI explanation', ok: true, limited: true,
    detail: 'No usable provider key. Deterministic checks remain executable; explanation is unavailable. This is not release readiness.' })

await check('PostgreSQL', async () => {
  const client = new PrismaClient()
  try { await client.$queryRaw`SELECT 1` } finally { await client.$disconnect() }
  return 'reachable'
})

await check('Redis', async () => {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is missing')
  const redis = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  })
  try {
    await redis.connect()
    await redis.ping()
  } finally {
    redis.disconnect()
  }
  return 'reachable'
})

await check('Chromium', async () => {
  const { chromium } = await import('playwright')
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  for (const executable of candidates) {
    try {
      await access(executable)
      return executable
    } catch {
      // Keep checking the same fallbacks used by the audit browser runtime.
    }
  }
  throw new Error(`No Chromium executable found in ${candidates.join(', ')}`)
})

await check('migrations', async () => {
  const result = spawnSync('npx', ['prisma', 'migrate', 'status'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    timeout: 10_000,
  })
  if (result.status !== 0) throw new Error((result.stdout || result.stderr).trim() || 'Migration status failed')
  return 'database schema current'
})

await check('worker prerequisites (not liveness)', async () => {
  await access(new URL('../worker/index.ts', import.meta.url))
  if (!process.env.REDIS_URL) throw new Error('Redis is required by the worker')
  return 'entry point and queue dependency ready'
})

if (process.argv.includes('--live')) {
  await check('live worker and browser', async () => {
    const state = await readRuntimeState()
    const managed = state ? await requestRuntimeControl(state, 'status') : null
    const origin = managed?.origin ?? process.env.NEXT_PUBLIC_APP_URL
    const database = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!database.ok) throw new Error('Web/database health unavailable')
    const response = await fetch(`${origin}/api/health/worker`, { signal: AbortSignal.timeout(5000) })
    const health = response.ok ? await response.json() : null
    const result = localReadiness(health, managed?.workerId ?? process.env.FIXFLAGS_WORKER_ID)
    if (!result.ready) throw new Error(result.detail)
    return result.detail
  })
}

const failed = results.filter((result) => !result.ok)
for (const result of results) {
  console.log(`${result.limited ? 'LIMIT' : result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`)
}
if (failed.length) {
  console.error('\nFix the failed prerequisites, then run npm run doctor again.')
  process.exitCode = 1
}
