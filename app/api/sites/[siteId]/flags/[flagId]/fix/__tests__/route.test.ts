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

  it.each(['', '   '])('rejects missing guidance without recording a handoff: %j', async fix => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag, fix, repairGuidance: 'unavailable' } })
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'copy' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) })
    expect(response.status).toBe(422)
    expect((await response.json()).prompt).toBeUndefined()
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

  it.each(['prepare', 'copy'].flatMap(action => [403, 404].map(status => ({ action, status }))))('never loads private prompt data when $action ownership is refused ($status)', async ({ action, status }) => {
    mocks.requireSiteOwner.mockResolvedValue({ ok: false, status, message: 'Site access refused' })
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action }),
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

  it('prepares the complete original task without recording a copied handoff', async () => {
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/improvement-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'prepare' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'improvement-1' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.prompt).toContain('FixFlags Flag: Checkout button is hidden')
    expect(body.sourceFlagId).toBe('flag-1')
    expect(body.promptHash).toMatch(/^[a-f0-9]{64}$/)
    expect(body.handoff).toBeUndefined()
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

  it('refuses changed guidance rather than acknowledging a different copied task', async () => {
    const context = { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) }
    const request = (body: unknown) => new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify(body),
    })
    const prepared = await (await POST(request({ action: 'prepare' }), context)).json()
    const original = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...original, flag: { ...original.flag, fix: 'Use a different complete repair task.' } })
    const response = await POST(request({ action: 'copy', promptHash: prepared.promptHash }), context)
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('REPAIR_TASK_CHANGED')
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

  it('acknowledges the exact prepared task after the caller confirms copying', async () => {
    const context = { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) }
    const request = (body: unknown) => new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify(body),
    })
    const prepared = await (await POST(request({ action: 'prepare' }), context)).json()
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
    const response = await POST(request({ action: 'copy', promptHash: prepared.promptHash }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).prompt).toBe(prepared.prompt)
    expect(mocks.executeSiteCommand).toHaveBeenCalledOnce()
    expect(mocks.executeSiteCommand).toHaveBeenCalledWith(expect.objectContaining({ flagId: prepared.sourceFlagId }))
  })

  it('does not return a successful acknowledgement without an actual command receipt', async () => {
    mocks.executeSiteCommand.mockResolvedValue({ ok: true, handoff: null })
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'copy' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) })
    expect(response.status).toBe(500)
    expect((await response.json()).ok).not.toBe(true)
  })
  it('includes every recorded page and device in the actual website copy action', async () => {
    const detail = await mocks.loadSiteBoardFlag()
    detail.flag.supportingObservations = ['desktop', 'mobile'].map((device, index) => ({
      source: 'DETERMINISTIC', checkId: 'hidden-cta', checkVersion: 2,
      pageUrl: 'https://example.com/product-' + index, evidence: device + ' button is outside the viewport',
      recordedAt: '2026-10-16T12:00:00.000Z', references: [{ device, label: 'Checkout', selector: '#checkout-' + index }],
    }))
    mocks.loadSiteBoardFlag.mockResolvedValue(detail)
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'copy' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) })
    expect(response.status).toBe(200)
    const { prompt } = await response.json()
    for (const text of ['product-0', 'product-1', 'desktop button', 'mobile button', '#checkout-0', '#checkout-1',
      'Version: 2', '2026-10-16T12:00:00.000Z', 'Recheck every recorded supporting observation']) expect(prompt).toContain(text)
  })

  it.each(['projection', 'invalid-view'])('does not record a handoff when supporting evidence is unreadable: %s', async condition => {
    const detail = await mocks.loadSiteBoardFlag()
    if (condition === 'projection') detail.flag.supportingEvidenceUnreadable = true
    else detail.flag.supportingObservations = { version: 9, items: [] }
    mocks.loadSiteBoardFlag.mockResolvedValue(detail)
    const response = await POST(new NextRequest('http://localhost/api/sites/site-1/flags/flag-1/fix', {
      method: 'POST', body: JSON.stringify({ action: 'copy' }),
    }), { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) })
    expect(response.status).toBe(422)
    expect((await response.json()).prompt).toBeUndefined()
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

})
