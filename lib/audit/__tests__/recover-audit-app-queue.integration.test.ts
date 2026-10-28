import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { retireLegacyExecution } from '../retire-legacy-execution'

const database = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
database('legacy delivery retirement', () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('preserves observations and terminal evidence while retiring an unfinished admission once', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CAPTURING' } })
    try {
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', confidence: 1, position: 0, whyItMatters: 'Customers cannot continue', rubric: 'REACH', severity: 'IMPORTANT',
        problem: 'Recorded failure', evidence: 'Original observation', fix: 'Repair the observed failure' } })
      expect(await retireLegacyExecution(audit.id)).toBe(true)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'FAILED', failureCode: 'LEGACY_EXECUTION_RETIRED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toEqual(flag)
      expect(await retireLegacyExecution(audit.id)).toBe(false)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('does not take a live execution lease', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CAPTURING',
      executionToken: 'another-owner', executionLeaseUntil: new Date(Date.now() + 60_000) } })
    try {
      expect(await retireLegacyExecution(audit.id)).toBe(false)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
})
