import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local', quiet: true })
const source = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Execution integration verification requires local PostgreSQL')
const suffix = randomUUID().replaceAll('-', '')
const databaseName = `fixflags_execution_test_${suffix}`
const redisName = `fixflags-execution-test-${suffix}`
const disposable = new URL(source)
disposable.pathname = '/' + databaseName
disposable.search = ''
const admin = new PrismaClient()
let created = false
let redisCreated = false

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 120_000 })
  if (result.status !== 0) throw new Error([result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n') || 'Verification process failed')
  return result.stdout.trim()
}

try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`)
  created = true
  const env = { ...process.env, DATABASE_URL: disposable.toString() }
  const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))
  run(process.execPath, [prismaCli, 'migrate', 'deploy'], env)
  console.log('Full migration history applied to the disposable database.')
  run(process.execPath, [prismaCli, 'migrate', 'status'], env)
  const drift = run(process.execPath, [prismaCli, 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma',
    '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], env)
  console.log(drift)
  run('docker', ['run', '--detach', '--name', redisName, '--publish', '127.0.0.1::6379',
    'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no'])
  redisCreated = true
  const port = run('docker', ['port', redisName, '6379/tcp']).split(':').at(-1)
  const output = run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
    'lib/audit/progressive/__tests__/execution.integration.test.ts',
    'lib/audit/progressive/__tests__/dispatch.integration.test.ts', 'lib/audit/browser/keyboard-probe.test.ts', ...process.argv.slice(2)], {
    ...env, REDIS_URL: `redis://127.0.0.1:${port}`, PROGRESSIVE_EXECUTION_DB_REQUIRED: 'true',
    KEYBOARD_BROWSER_REQUIRED: 'true',
    TOKEN_ENCRYPTION_KEY: '11'.repeat(32), OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', PAGESPEED_API_KEY: '',
    R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', RESEND_API_KEY: '',
  })
  console.log(output)
} finally {
  try {
    if (redisCreated) run('docker', ['rm', '--force', redisName])
  } finally {
    try {
      if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    } finally { await admin.$disconnect() }
  }
}
