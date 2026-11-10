import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BrokenLinkCheckerClient } from '../BrokenLinkCheckerClient'
import { TOOLS } from '@/lib/marketing/copy-barrel'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: ({ initialUrl }: { initialUrl?: string }) => <div data-testid="audit" data-url={initialUrl ?? ''} /> }))
vi.mock('@/lib/analytics/events', () => ({ trackToolInteraction: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals() })

const C = TOOLS.brokenLinks
const respond = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))

it('lists broken links with their status and hands the page to the full check', async () => {
  respond({ url: 'https://shop.com/', checked: 40, skipped: 3, error: null, broken: [
    { url: 'https://shop.com/pricing', path: '/pricing', text: 'Pricing', status: 404, problem: 'error_status' },
    { url: 'https://shop.com/help', path: '/help', text: '', status: null, problem: 'unreachable' },
  ] })
  render(<BrokenLinkCheckerClient />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Website URL' }), { target: { value: 'shop.com' } })
  fireEvent.click(screen.getByRole('button', { name: C.ctaScan }))
  expect(await screen.findByRole('heading', { name: C.brokenHeading(2) })).toBeVisible()
  expect(screen.getByText(C.status(404))).toBeVisible()
  expect(screen.getByText(C.status(null))).toBeVisible()
  expect(screen.getByText(C.summary(40, 3))).toBeVisible()
  expect(screen.getByTestId('audit')).toHaveAttribute('data-url', 'https://shop.com/')
})

it('says when every checked link opened, and shows tool errors', async () => {
  respond({ url: 'https://shop.com/', checked: 5, skipped: 0, error: null, broken: [] })
  const { unmount } = render(<BrokenLinkCheckerClient />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Website URL' }), { target: { value: 'shop.com' } })
  fireEvent.click(screen.getByRole('button', { name: C.ctaScan }))
  expect(await screen.findByText(C.clearSubhead(5))).toBeVisible()
  unmount()
  respond({ url: 'https://x.com', checked: 0, skipped: 0, broken: [], error: 'We couldn’t open that page. Check the address and try again.' })
  render(<BrokenLinkCheckerClient />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Website URL' }), { target: { value: 'x.com' } })
  fireEvent.click(screen.getByRole('button', { name: C.ctaScan }))
  expect(await screen.findByText(/couldn’t open that page/)).toBeVisible()
})
