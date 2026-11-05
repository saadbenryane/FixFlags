import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { WebsitesDashboard } from '../WebsitesDashboard'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SITE_SUMMARY_OWNER_HEADER, SITE_SUMMARY_READ_AT_HEADER } from '@/lib/sites/summary-contract'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { WEBSITES_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

const me = vi.hoisted(() => ({ user: { id: 'owner-a' }, refresh: vi.fn() }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ ...me, claimUpgrade: null, dismissClaimUpgrade: vi.fn() }) }))
vi.mock('@/components/auth/AuthFlow', () => ({ AuthFlow: () => null }))
function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, isVisible: () => true,
    isOnline: () => true, onErrorRetry: () => {} }}>{children}</SWRConfig>
}
function site(checking = true): SiteSummary {
  const presentation = siteViewFixture().presentation
  presentation.run.state = checking ? 'running' : 'idle'
  presentation.result = { state: checking ? 'checking' : 'flags', label: checking ? 'Checking' : '3 Flags' }
  presentation.flags = { count: checking ? 0 : 3, label: checking ? '0 Flags' : '3 Flags', fixFirstCount: 0 }
  return { id: 'fixture-site', name: 'Example', hostname: 'example.com', presentation,
    lastUsefulChangeAt: '2026-11-03T00:00:00Z' }
}
beforeEach(() => { vi.useFakeTimers(); me.user = { id: 'owner-a' }; me.refresh.mockReset() })
afterEach(async () => { cleanup(); await act(async () => { await vi.advanceTimersByTimeAsync(0) }); vi.unstubAllGlobals(); vi.useRealTimers() })

it('updates results without resetting the URL the customer is typing', async () => {
  const fetch = vi.fn(async () => Response.json([site(false)], { headers: { [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()) } }))
  vi.stubGlobal('fetch', fetch)
  render(<WebsitesDashboard initialSites={[site()]} ownerId="owner-a" readAt={Date.now()} resumedUrl={null} />, { wrapper })
  const input = screen.getByRole('textbox', { name: 'Website URL' })
  const websites = screen.getByRole('region', { name: WEBSITES_COPY.count(1) })
  expect(websites.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.change(input, { target: { value: 'another.example/pricing' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(screen.getByText('3 Flags')).toBeVisible()
  expect(input).toHaveValue('another.example/pricing')
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/sites', expect.objectContaining({ cache: 'no-store' }))
})

it('keeps retained websites and the draft visible while one retry recovers an interrupted refresh', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  render(<WebsitesDashboard initialSites={[site()]} ownerId="owner-a" readAt={Date.now()} resumedUrl={null} />, { wrapper })
  const input = screen.getByRole('textbox', { name: 'Website URL' })
  fireEvent.change(input, { target: { value: 'keep-this.example/pricing' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  const retry = screen.getByRole('button', { name: SITE_ACTION_COPY.retryResults })
  retry.focus()
  await act(async () => { fireEvent.click(retry); fireEvent.click(retry); await vi.advanceTimersByTimeAsync(0) })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(retry).toBeDisabled()
  expect(retry).toHaveAttribute('aria-busy', 'true')
  expect(input).toHaveValue('keep-this.example/pricing')
  expect(screen.getByText('example.com')).toBeVisible()
  await act(async () => { finish(Response.json([site(false)], { headers: {
    [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()),
  } })) })
  expect(screen.queryByRole('button', { name: SITE_ACTION_COPY.retryResults })).not.toBeInTheDocument()
  expect(screen.getByText('3 Flags')).toBeVisible()
  expect(input).toHaveValue('keep-this.example/pricing')
  expect(screen.getByRole('heading', { name: WEBSITES_COPY.count(1) })).toHaveFocus()
})

it('updates the first-website introduction when a Site arrives, while preserving the draft', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([site(false)], { headers: { [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()) } })))
  render(<WebsitesDashboard initialSites={[]} ownerId="owner-a" readAt={Date.now()} resumedUrl={null} />, { wrapper })
  const input = screen.getByRole('textbox', { name: 'Website URL' })
  fireEvent.change(input, { target: { value: 'my-next.example' } })
  expect(screen.getByRole('heading', { name: WEBSITES_COPY.firstTitle })).toBeVisible()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(screen.getByRole('heading', { name: WEBSITES_COPY.analyzeTitle })).toBeVisible()
  expect(screen.queryByRole('heading', { name: WEBSITES_COPY.firstTitle })).not.toBeInTheDocument()
  expect(input).toHaveValue('my-next.example')
})

it.each(['empty', 'outside'] as const)('handles %s focus when a dashboard retry settles', async mode => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })))
  render(<WebsitesDashboard initialSites={[site()]} ownerId="owner-a" readAt={Date.now()} resumedUrl={null} />, { wrapper })
  const input = screen.getByRole('textbox', { name: 'Website URL' })
  fireEvent.change(input, { target: { value: 'retained.example/pricing' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  const retry = screen.getByRole('button', { name: SITE_ACTION_COPY.retryResults })
  retry.focus()
  await act(async () => { fireEvent.click(retry); await vi.advanceTimersByTimeAsync(0) })
  if (mode === 'outside') input.focus()
  await act(async () => { finish(Response.json(mode === 'empty' ? [] : [site(false)], { headers: {
    [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()),
  } })) })
  expect(input).toHaveValue('retained.example/pricing')
  if (mode === 'outside') expect(input).toHaveFocus()
  else expect(screen.getByRole('heading', { name: WEBSITES_COPY.firstTitle })).toHaveFocus()
})

it('retires pending retry focus when another account opens the dashboard', async () => {
  let finish!: (response: Response) => void
  const second = site(false); second.id = 'second-site'; second.hostname = 'second.example.com'
  second.presentation.identity = { ...second.presentation.identity, siteId: second.id }
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockImplementation(async () => Response.json([second], { headers: {
      [SITE_SUMMARY_OWNER_HEADER]: 'owner-b', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()),
    } }))
  vi.stubGlobal('fetch', fetch)
  const props = { initialSites: [site()], ownerId: 'owner-a', readAt: Date.now(), resumedUrl: null }
  const rendered = render(<WebsitesDashboard {...props} />, { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  const retry = screen.getByRole('button', { name: SITE_ACTION_COPY.retryResults })
  retry.focus()
  await act(async () => { fireEvent.click(retry); await vi.advanceTimersByTimeAsync(0) })
  me.user = { id: 'owner-b' }
  await act(async () => { rendered.rerender(<WebsitesDashboard {...props} />); await vi.advanceTimersByTimeAsync(0) })
  expect(screen.getByText('second.example.com')).toBeVisible()
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()
  await act(async () => { finish(Response.json([site(false)], { headers: {
    [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()),
  } })) })
  expect(document.body).toHaveFocus()
  expect(screen.getByText('second.example.com')).toBeVisible()
})

it('withholds private rows and the entry form when the session expires', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 401 })))
  render(<WebsitesDashboard initialSites={[site()]} ownerId="owner-a" readAt={Date.now()} resumedUrl={null} />, { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(screen.queryByText('example.com')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Website URL' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: SITE_ACTION_COPY.signInAction })).toHaveAttribute('href', '/sign-in?next=%2Fdashboard')
  expect(me.refresh).toHaveBeenCalledTimes(1)
})

it('reconciles a changed account once and still permits an explicit retry', async () => {
  const fetch = vi.fn(async () => Response.json([site(false)], { headers: { [SITE_SUMMARY_OWNER_HEADER]: 'another-account' } }))
  vi.stubGlobal('fetch', fetch)
  const initialSites = [site()]
  const props = { initialSites, ownerId: 'owner-a', readAt: Date.now(), resumedUrl: null }
  const rendered = render(<WebsitesDashboard {...props} />, { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(screen.queryByText('example.com')).not.toBeInTheDocument()
  expect(me.refresh).toHaveBeenCalledTimes(1)
  me.user = { id: 'owner-a' }
  me.refresh = vi.fn()
  rendered.rerender(<WebsitesDashboard {...props} />)
  expect(me.refresh).not.toHaveBeenCalled()
  me.refresh.mockResolvedValue({ user: me.user })
  fetch.mockImplementation(async () => Response.json([site(false)], { headers: { [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(Date.now()) } }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: SITE_ACTION_COPY.retryResults })) })
  expect(me.refresh).toHaveBeenCalledTimes(1)
  expect(screen.getByText('3 Flags')).toBeVisible()
})
