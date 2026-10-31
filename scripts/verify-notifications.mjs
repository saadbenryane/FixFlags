import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local', quiet: true })
const base = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Notification verification requires a local PostgreSQL connection')
const suffix = randomUUID().replaceAll('-', '')
const names = [`fixflags_execution_test_${suffix}`, `fixflags_uptime_test_${suffix}`]
const urls = names.map(name => { const url = new URL(base); url.pathname = '/' + name; return url.toString() })
const adminUrl = new URL(base); adminUrl.pathname = '/postgres'
const admin = new Client({ connectionString: adminUrl.toString() }), created = []
function run(args, env, inherit = false) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, ...env },
    stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Notification verification failed during ${args[0].includes('prisma') ? 'migration or schema checks' : 'focused tests'}`)
}
try {
  await admin.connect()
  await admin.query(`CREATE DATABASE "${names[0]}"`); created.push(names[0])
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { DATABASE_URL: urls[0] })
  run(['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', urls[0], '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], {})
  await admin.query(`CREATE DATABASE "${names[1]}" TEMPLATE "${names[0]}"`); created.push(names[1])
  run(['node_modules/vitest/vitest.mjs', 'run',
    'lib/notifications/__tests__', 'lib/email/__tests__/delivery-events.integration.test.ts', 'lib/email/__tests__/nurture.integration.test.ts',
    'lib/email/__tests__/content.test.ts', 'lib/email/__tests__/send.test.ts', 'lib/email/__tests__/site-notification.test.ts',
    'lib/email/__tests__/website-summary.test.ts', 'lib/email/__tests__/notification-delivery.test.ts', 'lib/email/__tests__/watch-delivery.test.ts',
    'lib/uptime/alerts.integration.test.ts', 'lib/audit/__tests__/project-watch.test.ts', 'lib/sites/application/__tests__/list-sites.test.ts',
    'app/api/me/preferences/__tests__/route.test.ts', 'app/api/email/unsubscribe/__tests__/route.test.ts',
    'app/api/webhooks/resend/delivery/__tests__/route.test.ts', 'app/api/webhooks/resend/receiving/__tests__/route.test.ts',
    'lib/sites/accounts/__tests__/inbox.test.ts', 'components/settings/__tests__/EmailPreferences.test.tsx',
    'components/settings/__tests__/AccountSettingsForms.test.tsx', 'lib/queue/__tests__/recovery-scheduler.test.ts',
    'lib/billing/__tests__/notify.test.ts', 'app/api/demo-request/__tests__/route.test.ts'],
  { DATABASE_URL: urls[0], UPTIME_TEST_DATABASE_URL: urls[1], NOTIFICATION_DB_REQUIRED: 'true', RESEND_API_KEY: '',
    NEXT_PUBLIC_APP_URL: 'https://notification.example.test', BETTER_AUTH_SECRET: 'fixture-only-notification-signing-secret-32-characters' }, true)
  console.log('Notification migration, schema and focused behavior checks passed. No customer email was sent.')
} finally {
  for (const name of created.reverse()) await admin.query(`DROP DATABASE "${name}"`)
  await admin.end()
}
