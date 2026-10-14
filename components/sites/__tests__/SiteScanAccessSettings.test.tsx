import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteScanAccessSettings } from '../SiteScanAccessSettings'
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
    expect(fetcher).toHaveBeenLastCalledWith('/api/sites/site/scan-access', { method: 'DELETE' })
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
    expect(fetch).toHaveBeenLastCalledWith('/api/sites/site/scan-access', { method: 'DELETE' })
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
})
