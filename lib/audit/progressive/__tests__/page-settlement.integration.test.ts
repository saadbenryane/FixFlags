import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { parseMetadataFromHtml } from '../../metadata'
import { serializeArtifact } from '../contracts'
import { settleRecordedPages } from '../page-settlement'
import { settleFailedFinalization } from '../incomplete'

const localDatabase = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('page settlement from committed native collection', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('settles positively observed desktop documents without inventing metadata or passing checks', async () => {
    const url = 'https://example.com/', audit = await prisma.audit.create({ data: { url, status: 'FINALIZING' } })
    const cases = ['observed', 'blank', 'retained-gap', 'restricted', 'pending', 'http-error', 'wrong-scope', 'unknown-access', 'mobile', 'retained-metadata-only'] as const
    try {
      for (const [position, kind] of cases.entries()) {
        const pageUrl = url + kind
        const retained = kind.startsWith('retained-')
        const page = await prisma.auditPage.create({ data: { auditId: audit.id, url: pageUrl, normalizedUrl: pageUrl,
          role: 'review', position, status: retained ? 'FAILED' : 'CHECKING', completeness: 'UNKNOWN',
          ...(retained ? { failureCode: 'BROWSER_SCOPE_UNAVAILABLE', failureMessage: 'Earlier metadata collection was unavailable' } : {}) } })
        await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:browser:' + position,
          source: 'EXECUTION', workKind: 'browser', pageUrl, status: 'COMPLETED', workState: 'COMPLETED',
          workInput: { pageUrl, position, primary: false, role: 'review', device: 'desktop' },
          workResult: serializeArtifact('browser', { pageId: page.id,
            metadata: kind === 'retained-metadata-only' ? parseMetadataFromHtml('<title>Historical metadata</title>', pageUrl) : null,
            metadataFailure: { code: 'PARSER_CRASH', attempts: 2 }, snapshot: {
              desktopHtml: 'x'.repeat(kind === 'observed' ? 2_000_000 : 1), desktopHttpStatus: kind === 'http-error' ? 503 : 200,
              desktopFinalUrl: pageUrl, collectionRestrictions: [],
              desktopLoadExperience: { observation: { version: 1, device: kind === 'mobile' ? 'mobile' : 'desktop',
                ready: kind !== 'pending' && kind !== 'retained-metadata-only', restricted: kind === 'restricted', contentVisible: kind !== 'blank',
                scope: { pageUrl: kind === 'wrong-scope' ? url : pageUrl, finalUrl: pageUrl, profile: 'desktop',
                  access: kind === 'unknown-access' ? 'credentialed:unknown' : 'public' } } },
            } }),
        } })
      }
      const original = prisma.$queryRaw.bind(prisma)
      const read = vi.spyOn(prisma, '$queryRaw')
      try {
        await settleRecordedPages(prisma, audit.id)
        expect(read).toHaveBeenCalledTimes(1)
        const transferred = await read.mock.results[0].value
        expect(transferred).toHaveLength(cases.length)
        expect(Buffer.byteLength(JSON.stringify(transferred))).toBeLessThan(20_000)
      } finally { read.mockRestore() }
      const pages = await prisma.auditPage.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' } })
      expect(pages.slice(0, 3).every(page => page.status === 'COMPLETED' && page.completeness === 'PARTIAL' && page.htmlMetadata === null && page.failureCode === null)).toBe(true)
      expect(pages.slice(3, -1).every(page => page.status === 'FAILED' && page.completeness === 'PARTIAL')).toBe(true)
      expect(pages.at(-1)).toMatchObject({ status: 'FAILED', completeness: 'UNKNOWN', failureCode: 'BROWSER_SCOPE_UNAVAILABLE' })
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id } })).toBe(0)
      expect(await original`SELECT octet_length("workResult"#>>'{data,snapshot,desktopHtml}') AS bytes FROM audit_execution_tasks
        WHERE "auditId" = ${audit.id} AND "targetKey" = 'task:browser:0'`).toEqual([{ bytes: 2_000_000 }])
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('settles collection independently of optional work and refuses unsupported success during exhausted finalization', async () => {
    const url = 'https://example.com/', metadata = parseMetadataFromHtml('<title>Useful page</title><h1>Welcome</h1>', url)
    const audit = await prisma.audit.create({ data: { url, status: 'FINALIZING' } })
    const foreign = await prisma.audit.create({ data: { url, status: 'CHECKING' } })
    try {
      const page = async (key: string, position: number, status: 'CHECKING' | 'CAPTURING' | 'COMPLETED' | 'FAILED' | 'PARTIAL' = 'CHECKING') =>
        prisma.auditPage.create({ data: { auditId: audit.id, url: url + key, normalizedUrl: url + key, role: 'review', position,
          status, completeness: status === 'COMPLETED' ? 'FULL' : 'UNKNOWN',
          ...(status === 'FAILED' ? { failureCode: 'EXISTING_FAILURE', failureMessage: 'Original collection failure' } : {}) } })
      const good = await page('collected', 0), httpOnly = await page('http-only', 1), uncommitted = await page('uncommitted', 2)
      const absent = await page('absent', 3, 'CAPTURING'), wrongUrl = await page('other-url/', 4), noMetadata = await page('no-metadata', 5)
      const historical = await page('historical', 6, 'COMPLETED'), failed = await page('failed', 7, 'FAILED')
      const partial = await page('partial', 8, 'PARTIAL'), malformed = await page('malformed', 9)
      const mobileOnly = await page('mobile-only', 10), mobileMissing = await page('mobile-missing', 11)
      const desktopRequired = await page('desktop-required', 12)
      const foreignPage = await prisma.auditPage.create({ data: { auditId: foreign.id, url: url + 'foreign', normalizedUrl: url + 'foreign',
        role: 'primary', position: 0, status: 'CHECKING' } })
      const task = async (pageUrl: string, pageId: string, overrides: object = {}) => prisma.auditExecutionTask.create({ data: {
        auditId: audit.id, targetKey: 'task:' + randomUUID(), source: 'EXECUTION', workKind: 'browser', pageUrl,
        workInput: { pageUrl, position: 0, primary: false, role: 'review' }, status: 'COMPLETED', workState: 'COMPLETED',
        workResult: serializeArtifact('browser', { pageId, metadata }), ...overrides,
      } })
      await task(good.url, good.id)
      await task(httpOnly.url, httpOnly.id, { workKind: 'http', workResult: serializeArtifact('http', { metadata }) })
      await task(uncommitted.url, uncommitted.id, { workState: 'EXHAUSTED', status: 'FAILED' })
      await task(wrongUrl.url.replace(/\/$/, ''), wrongUrl.id)
      await task(noMetadata.url, noMetadata.id, { workResult: serializeArtifact('browser', { pageId: noMetadata.id, metadata: null }) })
      await task(failed.url, failed.id)
      await task(foreignPage.url, foreignPage.id)
      await task(malformed.url, malformed.id, { workResult: serializeArtifact('browser', { pageId: malformed.id, metadata: {} }) })
      for (const observed of [mobileOnly, mobileMissing, desktopRequired]) await task(observed.url, observed.id, {
        workInput: { pageUrl: observed.url, position: observed.position, primary: false, role: 'review', device: 'mobile' },
        workResult: serializeArtifact('browser', { pageId: observed.id, metadata: null,
          snapshot: { consoleCoverage: { mobile: { complete: observed !== mobileMissing } } } }),
      })
      await task(desktopRequired.url, desktopRequired.id, { workState: 'EXHAUSTED', status: 'FAILED',
        workInput: { pageUrl: desktopRequired.url, position: desktopRequired.position, primary: false, role: 'review', device: 'desktop' },
        workResult: undefined })
      // Missing media, provider or performance results do not erase collection.
      await task(good.url, good.id, { workKind: 'judge', status: 'FAILED', workState: 'EXHAUSTED', workResult: undefined })
      const before = await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.id }, orderBy: { id: 'asc' } })
      await prisma.$transaction(tx => settleFailedFinalization(tx, { id: 'finalizer', auditId: audit.id, workKind: 'finalize', workInput: {} }))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED',
        reportCompleteness: 'PARTIAL', failureCode: 'FINALIZATION_INCOMPLETE', verdict: null })
      expect(await prisma.auditPage.findUniqueOrThrow({ where: { id: good.id } })).toMatchObject({ status: 'COMPLETED', completeness: 'PARTIAL' })
      expect(await prisma.auditPage.findUniqueOrThrow({ where: { id: mobileOnly.id } })).toMatchObject({ status: 'COMPLETED', completeness: 'PARTIAL' })
      for (const unavailable of [httpOnly, uncommitted, absent, wrongUrl, noMetadata, malformed, mobileMissing, desktopRequired])
        expect(await prisma.auditPage.findUniqueOrThrow({ where: { id: unavailable.id } })).toMatchObject({ status: 'FAILED',
          completeness: 'PARTIAL', failureCode: 'BROWSER_SCOPE_UNAVAILABLE' })
      for (const unchanged of [historical, failed, partial, foreignPage])
        expect(await prisma.auditPage.findUniqueOrThrow({ where: { id: unchanged.id } })).toEqual(unchanged)
      const settled = await prisma.auditPage.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' } })
      await prisma.$transaction(tx => settleRecordedPages(tx, audit.id))
      expect(await prisma.auditPage.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' } })).toEqual(settled)
      expect(await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.id }, orderBy: { id: 'asc' } })).toEqual(before)
    } finally { await prisma.audit.deleteMany({ where: { id: { in: [audit.id, foreign.id] } } }) }
  })
})
