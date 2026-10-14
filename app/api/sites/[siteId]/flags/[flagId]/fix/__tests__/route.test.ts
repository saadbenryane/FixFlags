import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireSiteOwner: vi.fn(),
  loadSiteBoardFlag: vi.fn(),
  executeSiteCommand: vi.fn(),
}))

vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.requireSiteOwner }))
vi.mock('@/lib/sites/application/queries', () => ({ loadSiteBoardFlag: mocks.loadSiteBoardFlag }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: mocks.executeSiteCommand }))

import { POST } from '@/app/api/sites/[siteId]/flags/[flagId]/fix/route'

describe('POST /api/sites/[siteId]/flags/[flagId]/fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSiteOwner.mockResolvedValue({ ok: true, projectId: 'project-1', decision: { role: 'owner', site: { siteId: 'site-1', userId: 'user-1' } } })
    mocks.loadSiteBoardFlag.mockResolvedValue({
      flag: {
        id: 'improvement-1', sourceFlagId: 'flag-1', problem: 'Checkout button is hidden',
        whyItMatters: 'Customers cannot buy.', evidence: 'The button is outside the viewport.',
        evidenceMissing: false, fix: 'Move the button into view.', pageUrl: 'https://example.com/product',
        affectedPaths: ['https://example.com/product', 'https://example.com/other-product'],
        relatedOutcome: { id: 'checkout', name: 'Checkout' }, expectedBehavior: 'The button is visible.',
      },
    })
    mocks.executeSiteCommand.mockResolvedValue({ ok: true, handoff: { improvementId: 'improvement-1' } })
  })

  it.each([403, 404])('never loads or returns private prompt data when ownership is refused (%s)', async status => {
    mocks.requireSiteOwner.mockResolvedValue({ ok: false, status, message: 'Site access refused' })
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'copy' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) })
    expect(response.status).toBe(status)
    expect((await response.json()).prompt).toBeUndefined()
    expect(mocks.loadSiteBoardFlag).not.toHaveBeenCalled()
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

  it('returns the canonical server prompt and persists a handoff receipt', async () => {
    const request = new NextRequest('http://localhost/api/sites/site-1/flags/improvement-1/fix', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'copy' }),
    })
    const response = await POST(request, { params: Promise.resolve({ siteId: 'site-1', flagId: 'improvement-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.prompt).toContain('FixFlags Flag: Checkout button is hidden')
    expect(body.prompt).toContain('Expected after a fix: The button is visible.')
    expect(body.prompt).toContain('Affected pages:\n- https://example.com/product\n- https://example.com/other-product')
    expect(body.handoff).toEqual({ improvementId: 'improvement-1' })
    expect(mocks.executeSiteCommand).toHaveBeenCalledWith(expect.objectContaining({ flagId: 'flag-1', builder: 'copy' }))
  })
})
