import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteScanAccessSettings } from '../SiteScanAccessSettings'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const summary = { hasHttpBasic: true, cookieCount: 0, headerKeys: [], label: 'Preview' }
function response(configured: boolean) { return { ok: true, status: 200, json: async () => ({ configured, summary: configured ? summary : null }) } as Response }
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('saved Site access uses the existing credential command', () => {
  it('offers explicit removal when the saved encrypted grant cannot be read', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ code: 'ACCESS_UNREADABLE', message: 'Saved access could not be read.' }) }).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteScanAccessSettings siteId="site" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove saved access' }))
    await screen.findByText('Saved access removed. New checks use public access. Previously recorded evidence keeps its original scope.')
    expect(fetcher).toHaveBeenLastCalledWith('/api/sites/site/scan-access', expect.objectContaining({ method: 'DELETE', signal: expect.any(AbortSignal) }))
  })
  it('shows a redacted summary, replaces credentials and clears entered secrets after commit', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(true))
    vi.stubGlobal('fetch', fetch)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Saved website access is configured. Preview')
    expect((screen.getByLabelText('HTTP Basic password') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('HTTP Basic username'), { target: { value: 'synthetic-user' } })
    fireEvent.change(screen.getByLabelText('HTTP Basic password'), { target: { value: 'synthetic-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    await screen.findByText('Website access saved. Start a new check to use it. Saved access does not verify recovery.')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ scanAccess: { httpBasic: { username: 'synthetic-user', password: 'synthetic-secret' } } })
    expect(fetch.mock.calls[1][0]).toBe('/api/sites/site/scan-access')
    expect((screen.getByLabelText('HTTP Basic password') as HTMLInputElement).value).toBe('')
    expect(refresh).toHaveBeenCalledOnce()
  })
  it('keeps a failed load explicit and refuses replacement until the configured state is known', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(false)))
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByRole('button', { name: 'Try loading access again' })
    expect(screen.getByRole('button', { name: 'Save website access' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try loading access again' }))
    await screen.findByText('Checks use public access.')
  })
  it('removes access only after the existing command confirms removal', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetch)
    render(<SiteScanAccessSettings siteId="site" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove saved access' }))
    await screen.findByText('Saved access removed. New checks use public access. Previously recorded evidence keeps its original scope.')
    expect(fetch).toHaveBeenLastCalledWith('/api/sites/site/scan-access', expect.objectContaining({ method: 'DELETE', signal: expect.any(AbortSignal) }))
    expect(screen.queryByRole('button', { name: 'Remove saved access' })).toBeNull()
  })
  it('does not manufacture a successful save from an incomplete command response', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Checks use public access.')
    fireEvent.change(screen.getByLabelText('HTTP Basic username'), { target: { value: 'synthetic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FixFlags could not confirm this action.'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps a password with its draft instead of silently omitting it when a username is missing', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Checks use public access.')
    const password = screen.getByLabelText('HTTP Basic password')
    const username = screen.getByLabelText('HTTP Basic username')
    fireEvent.change(password, { target: { value: 'synthetic-secret' } })
    fireEvent.change(screen.getByLabelText('Request headers (JSON object)'), { target: { value: '{"X-Preview":"fixture"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    expect(screen.getByRole('alert')).toHaveTextContent(SITE_SETTINGS_COPY.access.usernameRequired)
    expect(username).toHaveFocus()
    expect(username).toHaveAttribute('aria-invalid', 'true')
    expect(username).toHaveAccessibleDescription(SITE_SETTINGS_COPY.access.usernameRequired)
    expect(password).toHaveValue('synthetic-secret')
    expect(fetcher).toHaveBeenCalledTimes(1)

    fireEvent.change(username, { target: { value: 'preview' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    await screen.findByText(SITE_SETTINGS_COPY.access.saved)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ scanAccess: {
      httpBasic: { username: 'preview', password: 'synthetic-secret' }, headers: { 'X-Preview': 'fixture' },
    } })
    expect(password).toHaveValue('')
    fireEvent.change(password, { target: { value: 'another-synthetic-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    expect(screen.getByRole('alert')).toHaveTextContent(SITE_SETTINGS_COPY.access.usernameRequired)
    expect(screen.queryByText(SITE_SETTINGS_COPY.access.saved)).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['Request headers (JSON object)', '{"X-Preview":', SITE_SETTINGS_COPY.access.invalidHeaders],
    ['Request headers (JSON object)', '{"X-Preview":42}', SITE_SETTINGS_COPY.access.invalidHeaders],
    ['Cookies (JSON array)', '[{"name":"session"}]', SITE_SETTINGS_COPY.access.invalidCookies],
  ])('reveals and focuses invalid %s without submitting or clearing the draft %s', async (label, draft, message) => {
    const fetcher = vi.fn().mockResolvedValue(response(true))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Saved website access is configured. Preview')
    const field = screen.getByLabelText(label)
    const details = field.closest('details')!
    fireEvent.change(field, { target: { value: draft } })
    expect(details.open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(field).toHaveValue(draft)
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(message)
    expect(details.open).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps empty header and cookie containers from replacing saved credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Saved website access is configured. Preview')
    fireEvent.change(screen.getByLabelText('Request headers (JSON object)'), { target: { value: '{}' } })
    fireEvent.change(screen.getByLabelText('Cookies (JSON array)'), { target: { value: '[]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    expect(screen.getByRole('alert')).toHaveTextContent(SITE_SETTINGS_COPY.access.credentialsRequired)
    expect(screen.getByText('Saved website access is configured. Preview')).toBeVisible()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves an explicitly empty Basic password when saving a valid username', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteScanAccessSettings siteId="site" />)
    await screen.findByText('Checks use public access.')
    fireEvent.change(screen.getByLabelText('HTTP Basic username'), { target: { value: 'preview' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save website access' }))
    await screen.findByText(SITE_SETTINGS_COPY.access.saved)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ scanAccess: { httpBasic: { username: 'preview', password: '' } } })
  })
})
