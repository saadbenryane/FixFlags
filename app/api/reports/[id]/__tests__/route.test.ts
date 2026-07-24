import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const getGatedAuditForRequest = vi.hoisted(() => vi.fn())
const buildUnifiedFixList = vi.hoisted(() => vi.fn())

vi.mock('@/lib/audit/fetch-audit', () => ({ getGatedAuditForRequest }))
vi.mock('@/lib/audit/load-finish-plan-flags', () => ({ buildUnifiedFixList }))

import { GET } from '@/app/api/reports/[id]/route'

describe('GET /api/reports/[id]', () => {
  beforeEach(() => {
    getGatedAuditForRequest.mockReset()
    buildUnifiedFixList.mockReset()
  })

  it('returns not found and forbidden without building a Fix List', async () => {
    getGatedAuditForRequest.mockResolvedValueOnce({ kind: 'not_found' })
    const missing = await GET({} as NextRequest, { params: Promise.resolve({ id: 'missing' }) })
    expect(missing.status).toBe(404)

    getGatedAuditForRequest.mockResolvedValueOnce({ kind: 'forbidden' })
    const forbidden = await GET({} as NextRequest, { params: Promise.resolve({ id: 'forbidden' }) })
    expect(forbidden.status).toBe(403)
    expect(buildUnifiedFixList).not.toHaveBeenCalled()
  })

  it('builds the unified Fix List with owner and access context', async () => {
    const audit = {
      id: 'report-1',
      userId: 'user-1',
      url: 'https://example.com/',
      isPublic: false,
      flags: [{ id: 'flag-1', status: 'OPEN' }],
      rubrics: [{ name: 'MESSAGE', grade: 'B' }],
      productContract: null,
    }
    getGatedAuditForRequest.mockResolvedValue({
      kind: 'ok',
      audit,
      showDeterministicFixes: true,
      sampleFixFlag: null,
    })
    buildUnifiedFixList.mockResolvedValue({
      items: [{ id: 'flag-1' }],
      totalCount: 1,
      visiblePromptCount: 1,
    })

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: 'report-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(buildUnifiedFixList).toHaveBeenCalledWith({
      userId: 'user-1',
      auditUrl: 'https://example.com/',
      flags: audit.flags,
      rubricRows: [{ name: 'MESSAGE', grade: 'B' }],
      contract: null,
      promptAccess: 'all',
      demonstratedFlag: null,
    })
    expect(body.fixList.totalCount).toBe(1)
    expect(body.id).toBe('report-1')
  })
})
