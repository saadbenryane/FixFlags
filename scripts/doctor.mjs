import 'dotenv/config'
import { access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import IORedis from 'ioredis'

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
  if (
    !hasUsableCredential(process.env.OPENAI_API_KEY) &&
    !hasUsableCredential(process.env.OPEN_CODE_API_KEY) &&
    !hasUsableCredential(process.env.OPENCODE_API_KEY) &&
    !hasUsableCredential(process.env.ANTHROPIC_API_KEY)
  ) {
    missing.push('a non-placeholder OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}`)
  return 'required values configured without obvious placeholders'
})

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

await check('worker', async () => {
  await access(new URL('../worker/index.ts', import.meta.url))
  if (!process.env.REDIS_URL) throw new Error('Redis is required by the worker')
  return 'entry point and queue dependency ready'
})

const failed = results.filter((result) => !result.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`)
}
if (failed.length) {
  console.error('\nFix the failed prerequisites, then run npm run doctor again.')
  process.exitCode = 1
}
