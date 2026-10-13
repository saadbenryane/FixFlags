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
const uptime = process.argv.includes('--uptime')
const databaseName = uptime ? `fixflags_uptime_test_${suffix}` : `fixflags_execution_test_${suffix}`
const redisName = `fixflags-execution-test-${suffix}`
const disposable = new URL(source)
disposable.pathname = '/' + databaseName
disposable.search = ''
const admin = new PrismaClient()
let created = false
let redisCreated = false

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 1_200_000 })
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
  const arguments_ = process.argv.slice(2).filter(argument => argument !== '--uptime')
  const only = arguments_[0] === '--only'
  const suites = only ? arguments_.slice(1) : [
    'lib/audit/progressive/__tests__/execution.integration.test.ts',
    'lib/audit/progressive/__tests__/dispatch.integration.test.ts', 'lib/audit/browser/keyboard-probe.test.ts', ...arguments_,
  ]
  if (!suites.some(argument => !argument.startsWith('-'))) throw new Error('Choose at least one focused verification suite')
  // Global scheduler and recovery suites share this disposable database.
  // Serialize files so one fixture cannot consume another file's work; tests
  // still exercise concurrent requests and worker deliveries within each suite.
  const output = run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--no-file-parallelism',
    ...suites], {
    ...env, REDIS_URL: `redis://127.0.0.1:${port}`, PROGRESSIVE_EXECUTION_DB_REQUIRED: 'true',
    ...(uptime ? { UPTIME_TEST_DATABASE_URL: disposable.toString() } : {}),
    KEYBOARD_BROWSER_REQUIRED: 'true',
    PROGRESSIVE_PROJECTION_DB_REQUIRED: 'true', DEFAULT_MONITORING_DB_REQUIRED: 'true',
    OUTCOME_CONFIRMATION_DB_REQUIRED: 'true', REVIEW_CONCURRENCY_DB_REQUIRED: 'true',
    RECOVERY_APP_QUEUE_REQUIRED: 'true', DIAGNOSTIC_BROWSER_REQUIRED: 'true',
    FIX_INTENTS_DB_REQUIRED: 'true', ACCESSIBILITY_DB_REQUIRED: 'true', CONSOLE_DB_REQUIRED: 'true',
    PUBLIC_TRUST_DB_REQUIRED: 'true', SCHEDULED_SITE_CARE_REQUIRED: 'true', CLAIM_SCHEDULER_DB_REQUIRED: 'true',
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
