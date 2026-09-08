import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getGatedAuditForRequest: vi.fn(),
  sendKeepReportEmail: vi.fn(),
  customerSiteIdForAudit: vi.fn(),
  siteBoardUrl: vi.fn(),
  upsert: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/audit/fetch-audit', () => ({
  getGatedAuditForRequest: mocks.getGatedAuditForRequest,
}))
vi.mock('@/lib/email/send', () => ({ sendKeepReportEmail: mocks.sendKeepReportEmail }))
vi.mock('@/lib/sites/site-id-for-audit', () => ({
  customerSiteIdForAudit: mocks.customerSiteIdForAudit,
  siteBoardUrl: mocks.siteBoardUrl,
}))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: vi.fn().mockResolvedValue({ exceeded: false }),
  requestClientId: () => 'client',
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.findUnique },
    newsletterSubscriber: { upsert: mocks.upsert },
  },
}))

import { POST } from '@/app/api/reports/[id]/keep/route'

describe('POST /api/reports/[id]/keep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getGatedAuditForRequest.mockResolvedValue({ kind: 'ok' })
    mocks.findUnique.mockResolvedValue({ id: 'audit_1', projectId: null })
    mocks.customerSiteIdForAudit.mockResolvedValue('p_abc')
    mocks.siteBoardUrl.mockReturnValue('https://fixflags.com/sites/p_abc')
    mocks.sendKeepReportEmail.mockResolvedValue({ sent: true })
    mocks.upsert.mockResolvedValue({})
  })

  it('emails the Site board, not /report', async () => {
    const req = {
      headers: new Headers(),
      json: async () => ({ email: 'owner@example.com' }),
    } as unknown as NextRequest
    const res = await POST(req, { params: Promise.resolve({ id: 'audit_1' }) })
    expect(res.status).toBe(200)
    expect(mocks.sendKeepReportEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'https://fixflags.com/sites/p_abc'
    )
  })
})
