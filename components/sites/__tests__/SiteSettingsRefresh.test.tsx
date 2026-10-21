import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import { SiteIntegrationsControls } from '../SiteIntegrationsControls'
import { SiteSettingsControls } from '../SiteSettingsControls'
import { ACCOUNT_CHECK_COPY } from '@/lib/marketing/copy/account-checks'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
import type { SiteHomeView } from '@/lib/sites/application/queries'

const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn() }) }))

function fixture() {
  const view = siteViewFixture()
  view.outcomes = []
  view.settings.shopify = { configured: true, state: 'connected', domain: 'old-shop.myshopify.com' }
  view.settings.analytics = { ...view.settings.analytics, configured: true, status: 'connected', propertyLabel: 'Original audience' }
  view.settings.searchConsole = { ...view.settings.searchConsole, configured: true, status: 'connected', propertyLabel: 'sc-domain:example.com' }
  return view
}

function Integrations({ initial }: { initial: SiteHomeView }) {
  const { view, refresh } = useSiteResource(initial.site.siteId, initial)
  return <SiteIntegrationsControls siteId={initial.site.siteId} initial={view.settings} onRefresh={refresh} />
}

function Settings({ initial }: { initial: SiteHomeView }) {
  const { view, refresh } = useSiteResource(initial.site.siteId, initial)
  return <SiteSettingsControls siteId={initial.site.siteId} initial={view.settings} watch={view.watch} onRefresh={refresh} />
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('authoritative Site settings refresh', () => {
  it('follows refreshed connection properties without retaining an older local copy', () => {
    const first = fixture(), next = fixture(), onRefresh = vi.fn(async () => undefined)
    next.settings.shopify.domain = 'current-shop.myshopify.com'
    next.settings.analytics.propertyLabel = 'Current audience'
    const view = render(<SiteIntegrationsControls siteId={first.site.siteId} initial={first.settings} onRefresh={onRefresh} />)
    view.rerender(<SiteIntegrationsControls siteId={next.site.siteId} initial={next.settings} onRefresh={onRefresh} />)
    expect(screen.getByText('current-shop.myshopify.com')).toBeVisible()
    expect(screen.getByText('Current audience')).toBeVisible()
    expect(screen.queryByText('old-shop.myshopify.com')).not.toBeInTheDocument()
    expect(screen.queryByText('Original audience')).not.toBeInTheDocument()
  })

  it('follows refreshed notification preferences', async () => {
    const first = fixture(), next = fixture(), onRefresh = vi.fn(async () => undefined)
    const fetch = vi.fn(async () => Response.json({ ok: true, notificationLevel: 'CRITICAL_ONLY', notifyOnRecovery: false }))
    vi.stubGlobal('fetch', fetch)
    next.settings.notificationLevel = 'OFF'; next.settings.notifyOnRecovery = false
    const view = render(<SiteSettingsControls siteId={first.site.siteId} initial={first.settings} watch={first.watch} onRefresh={onRefresh} />)
    view.rerender(<SiteSettingsControls siteId={next.site.siteId} initial={next.settings} watch={next.watch} onRefresh={onRefresh} />)
    expect(screen.getByRole('combobox', { name: 'Email me' })).toHaveValue('OFF')
    expect(screen.getByRole('checkbox', { name: /when a fix is verified/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /when a fix is verified/ })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: 'Email me' }), { target: { value: 'CRITICAL_ONLY' } })
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith('/api/sites/fixture-site/settings', expect.objectContaining({
      body: JSON.stringify({ notificationLevel: 'CRITICAL_ONLY' }),
    }))
  })

  it.each(['level', 'recovery'] as const)('preserves a concurrent preference when saving notification %s', async field => {
    const initial = fixture()
    let current = initial
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/sites/fixture-site') return Response.json(current)
      const changes = JSON.parse(String(options?.body))
      expect(changes).toEqual(field === 'level' ? { notificationLevel: 'CRITICAL_ONLY' } : { notifyOnRecovery: false })
      Object.assign(current.settings, changes)
      return Response.json({ ok: true, ...changes })
    })
    vi.stubGlobal('fetch', fetch)
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><Settings initial={initial} /></SWRConfig>)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    current = structuredClone(initial)
    if (field === 'level') {
      current.settings.notifyOnRecovery = false
      fireEvent.change(screen.getByRole('combobox', { name: 'Email me' }), { target: { value: 'CRITICAL_ONLY' } })
    } else {
      current.settings.notificationLevel = 'CRITICAL_ONLY'
      fireEvent.click(screen.getByRole('checkbox', { name: /when a fix is verified/ }))
    }
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Email me' })).toHaveValue('CRITICAL_ONLY')
      expect(screen.getByRole('checkbox', { name: /when a fix is verified/ })).not.toBeChecked()
    })
    expect(fetch.mock.calls.filter(([url]) => url === '/api/sites/fixture-site/settings')).toHaveLength(1)
  })

  it.each(['Shopify', 'Google Analytics', 'Google Search Console'] as const)('refreshes the validated Site resource after disconnecting %s', async name => {
    const initial = fixture()
    let current = initial
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/sites/fixture-site') return Response.json(current)
      expect(options?.method).toBe('DELETE')
      current = structuredClone(initial)
      if (name === 'Shopify') {
        expect(url).toBe('/api/sites/fixture-site/connections/shopify')
        current.settings.shopify = { configured: true, state: 'not_connected', domain: null }
      }
      else {
        expect(url).toBe('/api/sites/fixture-site/connections/google')
        expect(JSON.parse(String(options?.body))).toEqual({ provider: name === 'Google Analytics' ? 'ANALYTICS' : 'SEARCH_CONSOLE' })
        const key = name === 'Google Analytics' ? 'analytics' : 'searchConsole'
        current.settings[key] = { ...current.settings[key], status: 'revoked', detail: SITE_ACTION_COPY.settings.disconnectedDetail }
      }
      return Response.json({ ok: true })
    })
    vi.stubGlobal('fetch', fetch)
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><Integrations initial={initial} /></SWRConfig>)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: `Disconnect ${name}` }))
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url === '/api/sites/fixture-site')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: `Disconnect ${name}` })).not.toBeInTheDocument()
    if (name === 'Shopify') expect(screen.queryByText('old-shop.myshopify.com')).not.toBeInTheDocument()
    else {
      expect(screen.getByText(name === 'Google Analytics' ? 'Original audience' : 'sc-domain:example.com')).toBeVisible()
      expect(screen.getByText(SITE_ACTION_COPY.settings.disconnectedDetail)).toBeVisible()
    }
    expect(routerRefresh).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: name === 'Shopify' ? 'Disconnect Google Analytics' : 'Disconnect Shopify' })).toBeEnabled()
  })

  it.each(['unavailable', 'malformed'] as const)('retains dated connection state when the accepted disconnect refresh is %s', async failure => {
    const initial = fixture()
    let saved = false
    const fetch = vi.fn(async (url: string) => {
      if (url !== '/api/sites/fixture-site') { saved = true; return Response.json({ ok: true }) }
      if (!saved) return Response.json(initial)
      return failure === 'unavailable' ? Response.json({ error: 'Read unavailable' }, { status: 503 }) : Response.json({ settings: {} })
    })
    vi.stubGlobal('fetch', fetch)
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><Integrations initial={initial} /></SWRConfig>)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Shopify' }))
    expect(await screen.findByText(SITE_ACTION_COPY.refreshPending)).toBeVisible()
    expect(screen.getByText('old-shop.myshopify.com')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Disconnect Shopify' })).toBeEnabled()
    expect(screen.queryByText(SITE_ACTION_COPY.settings.shopifyDisconnected)).not.toBeInTheDocument()
  })

  it.each(['notifications', 'accounts'] as const)('waits for the validated Site view before changing saved %s', async setting => {
    const initial = fixture()
    initial.settings.accountChecks = { enabled: true, eligible: true, ready: true, canCleanup: false,
      reason: null, cleanupUnavailableReason: null, accounts: [], results: [] }
    const current = structuredClone(initial)
    let saved = false, release!: () => void
    const pendingRead = new Promise<void>(resolve => { release = resolve })
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/sites/fixture-site') { if (saved) await pendingRead; return Response.json(saved ? current : initial) }
      expect(options?.method).toBe('PATCH')
      saved = true
      if (setting === 'notifications') current.settings.notificationLevel = 'OFF'
      else current.settings.accountChecks!.enabled = false
      return Response.json({ ok: true, notificationLevel: current.settings.notificationLevel,
        notifyOnRecovery: true, accountChecksEnabled: current.settings.accountChecks!.enabled })
    })
    vi.stubGlobal('fetch', fetch)
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><Settings initial={initial} /></SWRConfig>)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const control = setting === 'notifications' ? screen.getByRole('combobox', { name: 'Email me' })
      : screen.getByRole('switch', { name: ACCOUNT_CHECK_COPY.enabled })
    if (setting === 'notifications') fireEvent.change(control, { target: { value: 'OFF' } })
    else fireEvent.click(control)
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url === '/api/sites/fixture-site')).toHaveLength(2))
    if (setting === 'notifications') expect(control).toHaveValue('FLAGS')
    else expect(control).toBeChecked()
    expect(control).toBeDisabled()
    release()
    await waitFor(() => {
      if (setting === 'notifications') expect(control).toHaveValue('OFF')
      else expect(control).not.toBeChecked()
      expect(control).toBeEnabled()
    })
    expect(routerRefresh).not.toHaveBeenCalled()
  })

  it('shows the actual paused and resumed schedule through the same Site resource', async () => {
    const initial = fixture()
    initial.site.watchInterval = 'weekly'
    initial.watch = { ...initial.watch, state: 'watching', interval: 'weekly', label: 'Weekly', nextRunAt: '2099-10-11T09:00:00Z' }
    let current = initial
    const actions: string[] = []
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/sites/fixture-site') return Response.json(current)
      expect(url).toBe('/api/sites/fixture-site/watch')
      expect(options?.method).toBe('POST')
      const { action } = JSON.parse(String(options?.body))
      actions.push(action)
      current = structuredClone(initial)
      if (action === 'pause') current.watch = { ...current.watch, state: 'paused', label: SITE_SETTINGS_COPY.paused, nextRunAt: null }
      return Response.json({ ok: true })
    })
    vi.stubGlobal('fetch', fetch)
    render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><Settings initial={initial} /></SWRConfig>)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: SITE_SETTINGS_COPY.pause }))
    expect(await screen.findByRole('button', { name: SITE_SETTINGS_COPY.resume })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: SITE_SETTINGS_COPY.resume }))
    expect(await screen.findByRole('button', { name: SITE_SETTINGS_COPY.pause })).toBeEnabled()
    expect(actions).toEqual(['pause', 'resume'])
    expect(fetch.mock.calls.filter(([url]) => url === '/api/sites/fixture-site')).toHaveLength(3)
  })
})
