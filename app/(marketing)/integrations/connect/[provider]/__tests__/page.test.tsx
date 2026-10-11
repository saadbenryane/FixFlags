import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectIntegrationPage from '../page'

const mocks = vi.hoisted(() => ({
  getAppViewer: vi.fn(),
  findMany: vi.fn(),
  configured: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

vi.mock('@/lib/auth/app-viewer', () => ({ getAppViewer: mocks.getAppViewer }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findMany: mocks.findMany } } }))
vi.mock('@/lib/sites/connections/google', () => ({ googleConnectionConfigured: mocks.configured }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))

describe('integration connection chooser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configured.mockReturnValue(true)
    mocks.getAppViewer.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.findMany.mockResolvedValue([{ id: 'site-1', name: 'My store', canonicalHost: 'example.com' }])
  })

  it('shows only the owner’s Sites and links to the selected provider', async () => {
    render(await ConnectIntegrationPage({ params: Promise.resolve({ provider: 'analytics' }) }))
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-1', deletedAt: null } }))
    expect(screen.getByRole('link', { name: /My store/ })).toHaveAttribute('href', '/sites/site-1/settings#connection-analytics')
  })

  it('preserves the connection destination through sign-in', async () => {
    mocks.getAppViewer.mockResolvedValue(null)
    await expect(ConnectIntegrationPage({ params: Promise.resolve({ provider: 'search-console' }) })).rejects.toThrow('REDIRECT:/sign-in?next=%2Fintegrations%2Fconnect%2Fsearch-console')
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('does not expose unknown providers', async () => {
    await expect(ConnectIntegrationPage({ params: Promise.resolve({ provider: 'unknown' }) })).rejects.toThrow('NOT_FOUND')
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('explains when the server cannot connect Google', async () => {
    mocks.configured.mockReturnValue(false)
    render(await ConnectIntegrationPage({ params: Promise.resolve({ provider: 'analytics' }) }))
    expect(screen.getByRole('status')).toHaveTextContent('not configured')
    expect(screen.queryByRole('link', { name: /My store/ })).not.toBeInTheDocument()
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
