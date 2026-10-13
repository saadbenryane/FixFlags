import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null }))
vi.mock('@/lib/db', async () => {
  const url = process.env.ADMIN_TEST_DATABASE_URL
  if (!url) return { prisma: {} }
  if (!new URL(url).pathname.includes('admin_test')) throw new Error('A disposable admin_test database is required')
  const { PrismaClient } = await import('@prisma/client')
  fixture.db = new PrismaClient({ datasourceUrl: url })
  return { prisma: fixture.db }
})
import { executionWrite, withExecutionOwnership } from '@/lib/audit/execution-ownership'
const db = () => fixture.db!
describe.skipIf(!process.env.ADMIN_TEST_DATABASE_URL)('operator lifecycle execution fencing in PostgreSQL', () => {
  beforeEach(async () => {
    await db().user.deleteMany({ where: { email: 'execution-fence@admin-test.invalid' } })
  })
  afterAll(async () => { await fixture.db?.$disconnect() })
  async function ownedExecution() {
    const user = await db().user.create({ data: { email: 'execution-fence@admin-test.invalid' } })
    const site = await db().project.create({ data: { userId: user.id, name: 'Fence proof', url: 'https://example.invalid', canonicalHost: 'execution-fence.invalid' } })
    const audit = await db().audit.create({ data: { userId: user.id, projectId: site.id, url: site.url, status: 'CHECKING', executionToken: 'owned-token', executionGeneration: 1, executionLeaseUntil: new Date(Date.now() + 60000), isPublic: false } })
    return { user, audit, owner: { auditId: audit.id, token: 'owned-token', generation: 1 } }
  }
  it('allows a leased execution while its customer is active', async () => {
    const { audit, owner } = await ownedExecution()
    await withExecutionOwnership(owner, () => executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { errorMsg: 'owned write' } })))
    expect((await db().audit.findUniqueOrThrow({ where: { id: audit.id } })).errorMsg).toBe('owned write')
  })
  it.each(['SUSPENDED', 'DELETING'] as const)('fences an in-flight write after customer state becomes %s', async (lifecycleStatus) => {
    const { user, audit, owner } = await ownedExecution()
    await db().user.update({ where: { id: user.id }, data: { lifecycleStatus } })
    await expect(withExecutionOwnership(owner, () => executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { errorMsg: 'unauthorized write' } })))).rejects.toMatchObject({ name: 'ExecutionOwnershipLost' })
    expect((await db().audit.findUniqueOrThrow({ where: { id: audit.id } })).errorMsg).toBeNull()
  })
})
