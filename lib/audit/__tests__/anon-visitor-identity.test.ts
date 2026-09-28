import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Regression cover for the two defects that broke the free-plan arrival path.
 *
 * 1. Anonymous scan reuse was matched on URL alone, so a first-time visitor who
 *    analyzed a URL anyone had analyzed in the last hour was handed that
 *    stranger's audit, never received a claim cookie, and therefore signed up to
 *    an empty account.
 * 2. The provisional Site board was keyed by the raw request IP, and collapsed
 *    onto a single shared literal when proxy headers were absent, so unrelated
 *    visitors shared one board and one visitor's IP was retained as a tenancy
 *    key.
 */

type ProvisionalScope = { sessionKey: string; canonicalHost: string }
type ProvisionalWhere = { sessionKey_canonicalHost: ProvisionalScope }
type ProvisionalCreate = { url: string; canonicalHost: string; primaryAuditId: string | null }
type ProvisionalUpdate = { url: string; primaryAuditId: string | null }
type ProvisionalUpsert = {
  where: ProvisionalWhere
  create: ProvisionalCreate
  update: ProvisionalUpdate
}

function provisionalKey(where: ProvisionalWhere): string {
  return `${where.sessionKey_canonicalHost.sessionKey}|${where.sessionKey_canonicalHost.canonicalHost}`
}

const mocks = vi.hoisted(() => {  const state = {
    provisionalUpsertArgs: null as null | ProvisionalWhere,
    provisionalFindUniqueArgs: null as null | ProvisionalWhere,
    ensureSiteArgs: null as null | { sessionKey: string | null },
    advisoryLocks: [] as string[],
    trackedAnonIds: [] as string[],
    auditsById: new Map<string, { id: string; status: string; parentId: string | null; url?: string }>(),
    /** Provisional rows the fake store knows about, keyed sessionKey|host. */
    provisional: new Map<string, { primaryAuditId: string | null }>(),
    createdAudits: [] as Array<{ id: string; url: string }>,
  }
  return { state }
})

vi.mock('@/lib/db', () => {
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      // The lock key is an interpolated value, not SQL text, so match on either.
      if (strings.join('?').includes('advisory') || String(values[0] ?? '').includes('anon-url-reuse')) {
        mocks.state.advisoryLocks.push(String(values[0]))
      }
      return 1
    },
    audit: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `audit-new-${mocks.state.createdAudits.length + 1}`
        mocks.state.createdAudits.push({ id, url: String(data.url) })
        return { id, parentId: (data.parentId as string | null) ?? null }
      },
      findFirst: async ({ where }: { where: { id: string; AND?: Array<{ status?: { not?: string } }> } }) => {
        const found = mocks.state.auditsById.get(where.id)
        if (!found) return null
        // Honour the nested `AND: [{ status: { not: 'FAILED' } }]` filter the
        // reuse query actually uses, so a failed owned scan is not reused.
        for (const clause of where.AND ?? []) {
          const not = clause?.status?.not
          if (not && found.status === not) return null
        }
        return found
      },
    },
    provisionalSite: {
      findUnique: async ({ where }: ProvisionalWhere) => {
        mocks.state.provisionalFindUniqueArgs = where
        const row = mocks.state.provisional.get(provisionalKey(where))
        return row ? { primaryAuditId: row.primaryAuditId } : null
      },
      upsert: async ({ where, create, update }: ProvisionalUpsert) => {
        mocks.state.provisionalUpsertArgs = where
        const next = { primaryAuditId: update?.primaryAuditId ?? create.primaryAuditId }
        mocks.state.provisional.set(provisionalKey(where), next)
        return {
          id: `prov-${provisionalKey(where)}`,
          url: update?.url ?? create.url,
          canonicalHost: create.canonicalHost,
          primaryAuditId: next.primaryAuditId,
          claimedProjectId: null,
        }
      },
    },
    project: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
      audit: tx.audit,
      provisionalSite: tx.provisionalSite,
      project: tx.project,
      $executeRaw: tx.$executeRaw,
    },
  }
})

vi.mock('@/lib/audit/usage', () => ({
  checkAnonymousAuditAllowed: vi.fn(async () => ({ allowed: true })),
  enforceAnonymousIpSoftCeiling: vi.fn(async () => undefined),
  trackAnonymousAuditId: vi.fn(async (id: string) => {
    mocks.state.trackedAnonIds.push(id)
  }),
}))

vi.mock('@/lib/sites/ensure-site', () => ({
  ensureSiteForAudit: vi.fn(async (args: { sessionKey?: string | null }) => {
    mocks.state.ensureSiteArgs = { sessionKey: args.sessionKey ?? null }
    return { siteId: `p_${args.sessionKey ?? 'none'}` }
  }),
}))

vi.mock('@/lib/sites/visitor-identity', () => ({
  resolveVisitorKey: vi.fn(async () => 'anon-v1:aaaaaaaaaaaaaaaa'),
  peekVisitorKey: vi.fn(async () => 'anon-v1:aaaaaaaaaaaaaaaa'),
}))

vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => ({ add: vi.fn(async () => undefined) }),
}))

vi.mock('@/lib/audit/ai-report-entitlement', () => ({
  resolveIncludeAiForNewAudit: vi.fn(async () => false),
}))

vi.mock('@/lib/audit/url', () => ({
  assertPublicAuditUrl: vi.fn(async (url: string) => new URL(url)),
}))

vi.mock('@/lib/audit/ensure-product-project', () => ({
  ensureProductProject: vi.fn(async () => null),
}))

vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: vi.fn(async () => undefined),
}))

vi.mock('@/lib/billing/usage-period', () => ({
  refreshUserUsagePeriod: vi.fn(async () => undefined),
  rollUserUsagePeriod: vi.fn(async () => null),
}))

vi.mock('@/lib/queue/estimate', () => ({ getWorkerQueueEstimate: vi.fn(async () => 0) }))

import { createAndEnqueueAudit } from '@/lib/audit/create-audit'

const URL_A = 'https://example.com/'
const HOST = 'example.com'

describe('anonymous scan reuse and Site ownership', () => {
  beforeEach(() => {
    mocks.state.advisoryLocks.length = 0
    mocks.state.trackedAnonIds.length = 0
    mocks.state.createdAudits.length = 0
    mocks.state.auditsById.clear()
    mocks.state.provisional.clear()
    mocks.state.provisionalUpsertArgs = null
    mocks.state.provisionalFindUniqueArgs = null
    mocks.state.ensureSiteArgs = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not hand a first-time visitor an unrelated audit for the same URL', async () => {
    // A stranger's recent, completed, public scan of the exact same URL.
    mocks.state.auditsById.set('audit-stranger', {
      id: 'audit-stranger',
      status: 'COMPLETED',
      parentId: null,
    })
    // ...and it is already recorded as some other visitor's board primary audit.
    mocks.state.provisional.set(`anon-v1:someoneelse|${HOST}`, {
      primaryAuditId: 'audit-stranger',
    })

    const result = await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa' })

    expect(result.reused).toBe(false)
    expect(result.auditId).not.toBe('audit-stranger')
    // The stranger's audit must remain on the stranger's board.
    expect(mocks.state.provisional.get(`anon-v1:someoneelse|${HOST}`)?.primaryAuditId).toBe(
      'audit-stranger',
    )
  })

  it('reuses a repeat scan only for the visitor who owns that board', async () => {
    mocks.state.auditsById.set('audit-mine', { id: 'audit-mine', status: 'COMPLETED', parentId: null })
    mocks.state.provisional.set(`anon-v1:aaaaaaaaaaaaaaaa|${HOST}`, {
      primaryAuditId: 'audit-mine',
    })

    const result = await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa' })

    expect(result.reused).toBe(true)
    expect(result.auditId).toBe('audit-mine')
    // Reuse must be queried with this visitor's own key, never a bare URL.
    expect(mocks.state.provisionalFindUniqueArgs?.sessionKey_canonicalHost.sessionKey).toBe(
      'anon-v1:aaaaaaaaaaaaaaaa',
    )
    expect(mocks.state.advisoryLocks[0]).toContain('anon-v1:aaaaaaaaaaaaaaaa')
  })

  it('starts a fresh scan when the owned audit failed', async () => {
    mocks.state.auditsById.set('audit-failed', { id: 'audit-failed', status: 'FAILED', parentId: null })
    mocks.state.provisional.set(`anon-v1:aaaaaaaaaaaaaaaa|${HOST}`, {
      primaryAuditId: 'audit-failed',
    })

    const result = await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa' })

    expect(result.reused).toBe(false)
  })

  it('claims the scan to the visitor even when the scan was reused', async () => {
    // Regression: the claim cookie was written only on the non-reused path, so a
    // returning visitor signed up to an account without their Site.
    mocks.state.auditsById.set('audit-mine', { id: 'audit-mine', status: 'COMPLETED', parentId: null })
    mocks.state.provisional.set(`anon-v1:aaaaaaaaaaaaaaaa|${HOST}`, {
      primaryAuditId: 'audit-mine',
    })

    await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa' })

    expect(mocks.state.trackedAnonIds).toEqual(['audit-mine'])
  })

  it('keys the Site board on the visitor identity, never on the request IP', async () => {
    await createAndEnqueueAudit({
      url: URL_A,
      clientId: '203.0.113.9',
      visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa',
    })

    expect(mocks.state.ensureSiteArgs?.sessionKey).toBe('anon-v1:aaaaaaaaaaaaaaaa')
    expect(mocks.state.ensureSiteArgs?.sessionKey).not.toContain('203.0.113.9')
  })

  it('never collapses unrelated visitors onto a shared key', async () => {
    // Two visitors, no proxy headers at all. The old code keyed both as
    // 'unknown' and put them on one shared board.
    const first = await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:aaaaaaaaaaaaaaaa' })
    const second = await createAndEnqueueAudit({ url: URL_A, visitorKey: 'anon-v1:bbbbbbbbbbbbbbbb' })

    expect(first.siteId).not.toBe(second.siteId)
    expect(mocks.state.provisionalFindUniqueArgs?.sessionKey_canonicalHost.sessionKey).toBe(
      'anon-v1:bbbbbbbbbbbbbbbb',
    )
  })
})
