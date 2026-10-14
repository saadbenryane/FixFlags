import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GithubConnectionControls } from '../GithubConnectionControls'
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it('keeps Site continuation on the actual authorization action', () => {
  render(<GithubConnectionControls connected={false} revoked={false} configured destination="/sites/owned?view=integrations" />)
  expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute('href', '/api/integrations/github/connect?next=%2Fsites%2Fowned%3Fview%3Dintegrations')
})
it('requires an explicit disconnect and reports unconfirmed external cleanup', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, revocation: 'unconfirmed' }) })
  vi.stubGlobal('fetch', fetcher)
  render(<GithubConnectionControls connected revoked={false} configured destination={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }))
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Revocation could not be confirmed.')
  expect(screen.getByRole('link', { name: 'Review GitHub authorizations' })).toHaveAttribute('href', 'https://github.com/settings/applications')
  expect(refresh).toHaveBeenCalledOnce()
})
it('does not convert an incomplete receipt to a successful disconnect', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
  render(<GithubConnectionControls connected revoked={false} configured destination={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm this action')
  expect(refresh).not.toHaveBeenCalled()
})
it('recovers an expired session through the same Site destination', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Sign in required', code: 'UNAUTHORIZED' }) }))
  render(<GithubConnectionControls connected revoked={false} configured destination="/sites/owned?view=integrations" />)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }))
  const link = await screen.findByRole('link', { name: 'Sign in again' })
  expect(new URL(link.getAttribute('href')!, 'https://example.com').searchParams.get('next')).toBe('/settings/integrations?next=%2Fsites%2Fowned%3Fview%3Dintegrations')
})
