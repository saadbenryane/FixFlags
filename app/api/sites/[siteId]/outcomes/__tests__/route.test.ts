import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { OUTCOME_CONFIRMATION } from '@/lib/marketing/copy'

const mocks = vi.hoisted(() => ({
  requireSiteAccess: vi.fn(),
  executeSiteCommand: vi.fn(),
}))

vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: mocks.executeSiteCommand }))
vi.mock('@/lib/db', () => ({ prisma: {} }))

import { POST } from '@/app/api/sites/[siteId]/outcomes/route'

const context = { params: Promise.resolve({ siteId: 'site-1' }) }

function request(body: unknown) {
  return new NextRequest('http://localhost/api/sites/site-1/outcomes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/sites/[siteId]/outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
    mocks.executeSiteCommand.mockResolvedValue({ ok: true, outcome: { id: 'out_1' } })
  })

  it('answers a refused confirmation with the reason, not a missing Outcome', async () => {
    // The customer needs to know FixFlags will not watch this yet, and why.
    // A 404 sends them looking for a row that exists.
    mocks.executeSiteCommand.mockResolvedValue({
      ok: false,
      error: OUTCOME_CONFIRMATION.kindRequired,
      code: 'OUTCOME_KIND_REQUIRED',
    })
    const response = await POST(request({ outcomeId: 'out_1', confirmed: true }), context)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('OUTCOME_KIND_REQUIRED')
    expect(body.message).toBe(OUTCOME_CONFIRMATION.kindRequired)
  })

  it('still answers a genuinely missing Outcome with 404', async () => {
    mocks.executeSiteCommand.mockResolvedValue({ ok: false, error: 'Outcome not found' })
    const response = await POST(request({ outcomeId: 'out_x', confirmed: true, kind: 'SIGNUP' }), context)
    expect(response.status).toBe(404)
  })

  it('confirms a page outcome through the kind that verifies it', async () => {
    const response = await POST(request({ watchPage: true }), context)
    expect(response.status).toBe(200)
    expect(mocks.executeSiteCommand).toHaveBeenCalledWith({ type: 'CONFIRM_PAGE_AVAILABILITY', siteId: 'site-1' })
  })

  it('refuses access before touching any command', async () => {
    mocks.requireSiteAccess.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    const response = await POST(request({ watchPage: true }), context)
    expect(response.status).toBe(404)
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })
})
