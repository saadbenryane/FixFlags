import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { config } from 'dotenv'
import { Client } from 'pg'
config({ path: '.env.local', quiet: true })
const base = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Local PostgreSQL required')
const database = 'fixflags_purge_test_' + randomUUID().replaceAll('-', '')
const url = new URL(base); url.pathname = '/' + database
const admin = new Client({ connectionString: base.toString() })
let created = false
function run(args, env) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, ...env }, stdio: 'inherit' })
  if (result.status !== 0) throw new Error('Focused purge verification failed')
}
try {
  await admin.connect(); await admin.query(`CREATE DATABASE "${database}"`); created = true
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { DATABASE_URL: url.toString() })
  run(['node_modules/vitest/vitest.mjs', 'run', 'lib/account/site-purge.integration.test.ts'], { DATABASE_URL: url.toString(), SITE_PURGE_DB_REQUIRED: 'true' })
} finally {
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`)
  await admin.end()
}
