import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

/** Fail the real monitor insert so setup must roll back before recording a retry. */
export async function rejectMonitorSetup(db: PrismaClient, projectIds: string[]) {
  const database = new URL(process.env.UPTIME_TEST_DATABASE_URL ?? '')
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use the disposable uptime execution verifier')
  if (!projectIds.length || projectIds.some(id => !/^[a-z0-9-]+$/.test(id))) throw new Error('Unexpected setup fixture identity')
  const constraint = 'fixture_uptime_setup_' + randomUUID().replaceAll('-', '')
  const ids = projectIds.map(id => "'" + id + "'").join(', ')
  await db.$executeRawUnsafe(`ALTER TABLE uptime_monitors ADD CONSTRAINT ${constraint} CHECK ("projectId" NOT IN (${ids})) NOT VALID`)
  return async () => { await db.$executeRawUnsafe(`ALTER TABLE uptime_monitors DROP CONSTRAINT IF EXISTS ${constraint}`) }
}
