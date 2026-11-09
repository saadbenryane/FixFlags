import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ access: vi.fn(), owner: vi.fn(), viewer: vi.fn(), path: vi.fn() }))
vi.mock('../request-access', () => ({ requireSiteAccess: state.access, requireSiteOwner: state.owner, currentSiteViewer: state.viewer }))
vi.mock('next/navigation', () => ({
  redirect: (href: string) => { throw new Error('redirect:' + href) },
  notFound: () => { throw new Error('not-found') },
}))
vi.mock('@/lib/auth/redirect-path', () => ({ getRequestedPath: state.path,
  signInUrl: (path: string) => '/sign-in?next=' + encodeURIComponent(path) }))

import { requireSitePageAccess, requireSiteOwnerPage } from '../page-access'

beforeEach(() => {
  vi.clearAllMocks()
  state.access.mockResolvedValue({ ok: false, status: 404 })
  state.owner.mockResolvedValue({ ok: false, status: 404 })
  state.viewer.mockResolvedValue({ userId: null })
  state.path.mockImplementation(async fallback => fallback)
})

describe.each([
  { kind: 'Site', guard: requireSitePageAccess, authorize: state.access },
  { kind: 'owner', guard: requireSiteOwnerPage, authorize: state.owner },
])('$kind page navigation', ({ guard, authorize }) => {
  it('retains the exact notification and reading context through authentication', async () => {
    const requested = '/sites/site-1/flags/flag-1?source=watch-email&view=timeline'
    state.path.mockResolvedValue(requested)
    await expect(guard('site-1', '/sites/site-1')).rejects.toThrow('redirect:/sign-in?next=' + encodeURIComponent(requested))
    expect(authorize).toHaveBeenCalledWith('site-1')
  })

  it('uses the known local page when request metadata is absent', async () => {
    await expect(guard('site-1', '/sites/site-1/settings')).rejects.toThrow('redirect:/sign-in?next=%2Fsites%2Fsite-1%2Fsettings')
  })

  it('retains authenticated refusal without consulting a return destination', async () => {
    state.viewer.mockResolvedValue({ userId: 'foreign-owner' })
    await expect(guard('site-1', '/sites/site-1')).rejects.toThrow('not-found')
    expect(state.path).not.toHaveBeenCalled()
  })

  it('returns the original current authority unchanged', async () => {
    const access = { ok: true, decision: { role: 'owner', site: { siteId: 'claimed-project' } }, projectId: 'claimed-project' }
    authorize.mockResolvedValue(access)
    expect(await guard('provisional-site', '/sites/provisional-site')).toBe(access)
    expect(state.viewer).not.toHaveBeenCalled()
    expect(state.path).not.toHaveBeenCalled()
  })

  it('does not convert an unavailable authorization decision into navigation', async () => {
    authorize.mockRejectedValue(new Error('Authorization unavailable'))
    await expect(guard('site-1', '/sites/site-1')).rejects.toThrow('Authorization unavailable')
    expect(state.viewer).not.toHaveBeenCalled()
  })
})

it('keeps the admitted anonymous creator view available without forcing authentication', async () => {
  const access = { ok: true, decision: { role: 'provisional_session', authenticated: false } }
  state.access.mockResolvedValue(access)
  expect(await requireSitePageAccess('site-1', '/sites/site-1')).toBe(access)
  expect(state.viewer).not.toHaveBeenCalled()
})
