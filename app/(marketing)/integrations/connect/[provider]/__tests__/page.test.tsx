import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectIntegrationPage from '../page'
const mocks = vi.hoisted(() => ({ getAppViewer: vi.fn(), findMany: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }), notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))
vi.mock('@/lib/auth/app-viewer', () => ({ getAppViewer: mocks.getAppViewer }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findMany: mocks.findMany } } }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
beforeEach(() => vi.clearAllMocks())
describe('integration release destinations', () => {
  it.each(['analytics', 'search-console', 'shopify'])('explains coming soon for %s without requesting or exposing owner data', async provider => {
    render(await ConnectIntegrationPage({ params: Promise.resolve({ provider }) }))
    expect(screen.getByText('Coming soon', { exact: true })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Check your website' })).toHaveAttribute('href', '/')
    expect(mocks.getAppViewer).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /connect|authorize/i })).not.toBeInTheDocument()
  })
  it('routes GitHub to its authenticated account connection management', async () => {
    await expect(ConnectIntegrationPage({ params: Promise.resolve({ provider: 'github' }) })).rejects.toThrow('REDIRECT:/settings/integrations')
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it('does not expose unknown providers', async () => {
    await expect(ConnectIntegrationPage({ params: Promise.resolve({ provider: 'unknown' }) })).rejects.toThrow('NOT_FOUND')
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
