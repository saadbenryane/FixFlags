import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteIntegrationsPanel } from '@/components/sites/SiteIntegrationsPanel'
import { SiteIntegrationsControls } from '@/components/sites/SiteIntegrationsControls'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { SiteAdvancedSettings } from '@/components/sites/SiteSettingsPanels'
import { SCAN_LIMIT_GATE } from '@/lib/marketing/copy-barrel'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteHomeView } from '@/lib/sites/application/queries'

const DAILY_ON_FREE =
  'Daily watching is available on Pro and Studio. Free Sites watch weekly.'

const push = vi.fn()
const refresh = vi.fn(async () => undefined)
const routeRefresh = vi.fn()

it('reveals advanced settings when a recovery link changes the current page hash', () => {
  const previous = window.location.href
  const rendered = render(<SiteAdvancedSettings><div id="scan-access">Access settings</div></SiteAdvancedSettings>)
  const disclosure = screen.getByText('Access settings').closest('details')!
  expect(disclosure).not.toHaveAttribute('open')
  window.history.replaceState(null, '', '#scan-access')
  fireEvent(window, new HashChangeEvent('hashchange'))
  expect(disclosure).toHaveAttribute('open')
  rendered.unmount()
  window.history.replaceState(null, '', previous)
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: routeRefresh, replace: vi.fn() }),
}))

function respond(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  }
}

function renderControls(googleConfigured = false, integrations = false, refreshed?: Partial<SiteHomeView['settings']>) {
  const fixture = siteViewFixture()
  let initial = { ...fixture.settings, shopify: { ...fixture.settings.shopify, configured: true },
    searchConsole: { ...fixture.settings.searchConsole, configured: googleConfigured },
    analytics: { ...fixture.settings.analytics, configured: googleConfigured } }
  const onRefresh = async () => {
    await refresh()
    if (refreshed) { initial = { ...initial, ...refreshed }; view.rerender(element()) }
  }
  const element = () => integrations
    ? <SiteIntegrationsControls siteId="site-1" initial={initial} onRefresh={onRefresh} />
    : <SiteSettingsControls siteId="site-1" watch={fixture.watch} initial={initial} onRefresh={onRefresh} />
  const view = render(element())
  return view
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
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows concise integration purposes and the available connection action', () => {
    renderControls(true, true)
    expect(screen.getByText('Storefront and checkout')).not.toBeVisible()
    fireEvent.click(screen.getByText('More integrations'))
    expect(screen.getByText('Storefront and checkout')).toBeVisible()
    expect(screen.getByText('Page traffic')).toBeVisible()
    expect(screen.getByText('Search demand')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Manage GitHub connection' })).toHaveTextContent('Connect')
    expect(screen.queryByText(/Planned:/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Coming soon')).toHaveLength(9)
  })

  it.each([
    ['connected', true, 'Manage'], ['revoked', true, 'Reconnect'], ['not_connected', true, 'Connect'], ['revoked', false, 'Manage'],
  ] as const)('shows the actual %s GitHub state', (status, configured, label) => {
    render(<SiteIntegrationsPanel {...siteViewFixture().settings} github={{ configured, status, login: 'site-owner' }} onDisconnectShopify={vi.fn()} onDisconnectGoogle={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Manage GitHub connection' })).toHaveTextContent(label)
    if (status === 'connected') expect(screen.getByText('site-owner')).toBeVisible()
  })

  it('does not offer a connection when GitHub setup is unavailable', () => {
    render(<SiteIntegrationsPanel {...siteViewFixture().settings} github={{ configured: false, status: 'not_connected', login: null }} onDisconnectShopify={vi.fn()} onDisconnectGoogle={vi.fn()} />)
    expect(screen.queryByRole('link', { name: 'Manage GitHub connection' })).not.toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeVisible()
  })

  it('persists notification preferences through the signed-in settings API', async () => {
    const fetchMock = vi.fn(async () => respond({ ok: true, notificationLevel: 'OFF', notifyOnRecovery: true }))
    vi.stubGlobal('fetch', fetchMock)
    renderControls(false, false, { notificationLevel: 'OFF', notifyOnRecovery: true })
    fireEvent.change(screen.getByRole('combobox', { name: 'Email me' }), { target: { value: 'OFF' } })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Email me' })).toHaveValue('OFF'))
    expect(fetchMock).toHaveBeenCalledWith('/api/sites/site-1/settings', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ notificationLevel: 'OFF' }),
    }))
    expect(screen.getByRole('checkbox', { name: /when a fix is verified/ })).toBeDisabled()
    expect(refresh).toHaveBeenCalled()
  })

  it('retains the saved notification preference when a change is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond({ error: 'Settings could not be saved.' }, 503)))
    renderControls()
    fireEvent.change(screen.getByRole('combobox', { name: 'Email me' }), { target: { value: 'OFF' } })
    expect(await screen.findByText('Settings could not be saved.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Email me' })).toHaveValue('FLAGS')
    expect(screen.getByRole('checkbox', { name: /when a fix is verified/ })).toBeEnabled()
    expect(refresh).not.toHaveBeenCalled()
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
