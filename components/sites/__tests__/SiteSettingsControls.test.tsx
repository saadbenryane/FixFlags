import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SCAN_LIMIT_GATE } from '@/lib/marketing/copy'

const DAILY_ON_FREE =
  'Daily watching is available on Pro and Studio. Free Sites watch weekly.'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}))

function respond(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  }
}

function renderControls() {
  return render(
    <SiteSettingsControls
      siteId="site-1"
      watch={{
        state: 'off',
        interval: null,
        nextRunAt: null,
        lastRunAt: null,
        lastError: null,
        covered: false,
        label: 'Not monitored',
        alert: { state: 'none', status: null, attempts: 0, at: null },
      }}
      initial={{
        notificationLevel: 'FLAGS',
        notifyOnRecovery: true,
        shopify: { configured: true, state: 'not_connected', domain: null },
        searchConsole: { provider: 'SEARCH_CONSOLE', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
        analytics: { provider: 'ANALYTICS', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
      }}
    />
  )
}

async function choose(label: 'Weekly' | 'Daily') {
  if (!screen.queryByRole('dialog')) fireEvent.click(screen.getByRole('button', { name: 'Edit schedule' }))
  const frequency = await screen.findByRole('combobox', { name: 'Check frequency' })
  await waitFor(() => expect(frequency).toBeEnabled())
  fireEvent.change(frequency, { target: { value: label.toLowerCase() } })
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
}

function mockOptions(save: (url: string, options?: RequestInit) => unknown) {
  return vi.fn(async (url: string, options?: RequestInit) => options?.method === 'POST' ? save(url, options) : respond({ intervals: ['weekly', 'daily'] }))
}

describe('SiteSettingsControls Watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not claim a different cadence than the one clicked', async () => {
    const fetchMock = mockOptions(() => respond({ ok: true, interval: 'daily' }))
    vi.stubGlobal('fetch', fetchMock)

    renderControls()
    await choose('Daily')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/site-1/watch',
      expect.objectContaining({ body: JSON.stringify({ interval: 'daily' }) })
    )
    expect(screen.queryByText(DAILY_ON_FREE)).not.toBeInTheDocument()
  })

  it('shows why a cadence above the plan was not applied, with a route to it', async () => {
    vi.stubGlobal(
      'fetch',
      mockOptions(() =>
        respond({
          ok: true,
          interval: 'weekly',
          requested: 'daily',
          code: 'INTERVAL_NOT_ALLOWED',
          message: DAILY_ON_FREE,
        })
      )
    )

    renderControls()
    // The applied cadence is stated, and the reason is stated next to it.
    await choose('Daily')
    await screen.findByText(DAILY_ON_FREE)

    expect(screen.getByText(DAILY_ON_FREE)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: SCAN_LIMIT_GATE.upgrade.secondaryCta })
    ).toHaveAttribute('href', '/pricing')
  })

  it('clears the notice once an allowed cadence is saved', async () => {
    const save = vi.fn().mockResolvedValueOnce(
        respond({
          ok: true,
          interval: 'weekly',
          requested: 'daily',
          code: 'INTERVAL_NOT_ALLOWED',
          message: DAILY_ON_FREE,
        })
      )
      .mockResolvedValueOnce(respond({ ok: true, interval: 'weekly' }))
    vi.stubGlobal('fetch', mockOptions(save))

    renderControls()
    await choose('Daily')
    await screen.findByText(DAILY_ON_FREE)
    expect(screen.getByText(DAILY_ON_FREE)).toBeInTheDocument()

    await choose('Weekly')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText(DAILY_ON_FREE)).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the server reason for a rejected save', async () => {
    vi.stubGlobal(
      'fetch',
      mockOptions(() =>
        respond(
          { code: 'WATCH_UNAVAILABLE', message: 'WATCH_UNAVAILABLE: Redis is not configured' },
          503
        )
      )
    )

    renderControls()
    await choose('Daily')
    expect(await screen.findByText('WATCH_UNAVAILABLE: Redis is not configured')).toBeVisible()
  })

  it('keeps the sign-in prompt when the session is gone', async () => {
    vi.stubGlobal(
      'fetch',
      mockOptions(() =>
        respond({ error: 'Sign in to keep watching this Site.', signup: true }, 401)
      )
    )

    renderControls()
    await choose('Daily')
    expect(await screen.findByText('Sign in to keep watching this Site.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite-1')
  })
})
