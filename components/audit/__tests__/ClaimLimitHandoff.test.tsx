import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MeProvider, useMe, type MeUser } from '@/hooks/useMe'
import { AUTH, PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy'
import { AuditInput } from '@/components/audit/AuditInput'

vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff: vi.fn().mockResolvedValue({ ok: true, siteId: 'site-1' }),
  trackStartedAudit: vi.fn(),
}))

const user: MeUser = {
  id: 'u1',
  email: 'a@b.com',
  plan: 'FREE',
  role: 'USER',
  isAdmin: false,
  checks: {
    used: 0,
    pending: 0,
    limit: 1,
    isUnlimited: false,
    remaining: 1,
    periodStart: '2026-01-01',
    periodEnd: '2026-02-01',
  },
  entitlements: {
    canExportSummary: false,
    canAccessPaidFeatures: false,
    canMonitor: false,
    canWatchProduct: false,
  },
  vibecodingLevel: null,
  preferredTools: [],
}

function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useMe>) => void }) {
  const me = useMe({ load: false })
  onReady(me)
  return (
    <ul>
      <li>claimUpgrade:{me.claimUpgrade?.kind ?? 'none'}</li>
      <li>claimUpgradeMessage:{me.claimUpgrade?.message ?? 'none'}</li>
      <li>error:{me.error ?? 'none'}</li>
    </ul>
  )
}

function renderProbe() {
  const api: { current?: ReturnType<typeof useMe> } = {}
  render(
    <MeProvider initialUser={user}>
      <Probe onReady={(me) => { api.current = me }} />
    </MeProvider>,
  )
  return api
}

describe('claim limit signal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('raises an upgrade signal for a plan limit instead of only a generic error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(409, {
          code: 'PROJECT_LIMIT',
          action: 'upgrade',
          message: 'Your plan supports 1 Product.',
          requestId: 'req-1',
        })
      )
    )
    const api = renderProbe()

    await api.current!.claimAnonymous()

    expect(await screen.findByText('claimUpgrade:claim-limit')).toBeInTheDocument()
    expect(screen.getByText('claimUpgradeMessage:Your plan supports 1 Product.')).toBeInTheDocument()
    // post-login still gets its error to hold the page and offer a retry.
    expect(screen.getByText(`error:${AUTH.me.claimError}`)).toBeInTheDocument()
  })

  it('keeps the generic error with no upgrade signal for an unknown failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(500, { code: 'INTERNAL', message: 'Boom', requestId: 'req-2' })
      )
    )
    const api = renderProbe()

    await api.current!.claimAnonymous()

    expect(await screen.findByText('claimUpgrade:none')).toBeInTheDocument()
    expect(screen.getByText(`error:${AUTH.me.claimError}`)).toBeInTheDocument()
  })

  it('keeps the generic error with no upgrade signal when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const api = renderProbe()

    await expect(api.current!.claimAnonymous()).resolves.toBeNull()

    expect(await screen.findByText('claimUpgrade:none')).toBeInTheDocument()
    expect(screen.getByText(`error:${AUTH.me.claimError}`)).toBeInTheDocument()
  })

  it('carries the signal across providers so the dashboard can render the notice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(409, { code: 'PROJECT_LIMIT', action: 'upgrade', requestId: 'req-3' })
      )
    )
    // post-login claims under the root provider; the dashboard notice renders
    // under the app provider. Two contexts, one session fact.
    let firstApi: ReturnType<typeof useMe> | null = null
    const root = render(
      <MeProvider initialUser={null}>
        <Probe onReady={(me) => { firstApi = me }} />
      </MeProvider>,
    )
    await (firstApi as unknown as ReturnType<typeof useMe>).claimAnonymous()
    expect(await screen.findByText('claimUpgrade:claim-limit')).toBeInTheDocument()
    root.unmount()

    render(
      <MeProvider initialUser={user}>
        <AuditInput idSuffix="-claim-limit" />
      </MeProvider>,
    )

    expect(
      await screen.findByText(PLAN_LIMIT_NOTICE.copy['claim-limit'].title)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })).toHaveAttribute(
      'href',
      '/pricing'
    )
  })

  it('clears the signal on a later successful claim', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        errorResponse(409, { code: 'PROJECT_LIMIT', action: 'upgrade', requestId: 'req-4' })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user, claimedCount: 1 }),
      } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)
    const api = renderProbe()

    await api.current!.claimAnonymous()
    expect(await screen.findByText('claimUpgrade:claim-limit')).toBeInTheDocument()

    await api.current!.claimAnonymous()
    await waitFor(() => expect(screen.getByText('claimUpgrade:none')).toBeInTheDocument())
  })

  it('lets the customer dismiss the notice and leaves no stale signal behind', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(409, {
          code: 'PROJECT_LIMIT',
          action: 'upgrade',
          message: 'Your plan supports 1 Product.',
          requestId: 'req-5',
        })
      )
    )
    const api = renderProbe()
    await api.current!.claimAnonymous()

    render(
      <MeProvider initialUser={user}>
        <AuditInput idSuffix="-claim-dismiss" />
      </MeProvider>,
    )
    await screen.findByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })
    fireEvent.click(screen.getByRole('button', { name: PLAN_LIMIT_NOTICE.dismissCta }))
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })).not.toBeInTheDocument()
    )
  })
})
