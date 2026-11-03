import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SitePageResults, type PageResult } from '../SitePageResults'
import { SitePages } from '../SitePages'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

function page(label: string, status = 'COMPLETED', flags: PageResult['flags'] = []): PageResult {
  return { url: `https://example.com${label}`, label, status, flags }
}
function card(label: string) {
  return screen.getByText(label).closest('article')!
}

it('keeps unfinished pages visible without turning missing evidence into a Flag', () => {
  render(<SitePageResults pages={[page('/checked'), page('/unavailable', 'FAILED'), page('/partial', 'PARTIAL')]} />)
  expect(screen.getByRole('heading', { level: 2, name: C.pageChecksIncomplete })).toBeVisible()
  expect(screen.queryByRole('heading', { name: C.noPageFlags })).not.toBeInTheDocument()
  expect(screen.getByText('/unavailable')).toBeVisible()
  expect(screen.getByText('/partial')).toBeVisible()
  expect(screen.getAllByText(C.checkIncomplete)).toHaveLength(2)
  expect(screen.getByText('/checked')).not.toBeVisible()
  expect(screen.queryByText(C.pageFlags(1))).not.toBeInTheDocument()
  fireEvent.click(screen.getByText(C.otherPages(1), { selector: 'summary' }))
  expect(screen.getByText('/checked')).toBeVisible()
})

it('keeps confirmed problems separate from incomplete checks and preserves their repair links', () => {
  const flag = { id: 'flag', title: 'The contact form failed', href: '/sites/site/flags/flag' }
  render(<SitePageResults headingLevel={3} pages={[page('/broken', 'PARTIAL', [flag]), page('/missing', 'UNKNOWN'), page('/checked')]} />)
  expect(screen.getByRole('heading', { level: 3, name: C.pagesNeedAttention(1) })).toBeVisible()
  expect(screen.getByRole('heading', { level: 4, name: C.pageChecksIncomplete })).toBeVisible()
  expect(within(card('/broken')).getByText(C.pageFlags(1))).toBeVisible()
  expect(within(card('/broken')).getByText(C.checkIncomplete)).toBeVisible()
  expect(within(card('/broken')).getByRole('link', { name: C.open(flag.title) })).toHaveAttribute('href', flag.href)
  expect(within(card('/missing')).queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('/missing')).toBeVisible()
  expect(screen.getByText('/checked')).not.toBeVisible()
})

it('shows queued and running page activity only while their owning analysis is active', () => {
  const pages = [page('/queued', 'QUEUED'), page('/checking', 'CHECKING'), page('/failed', 'FAILED')]
  const rendered = render(<SitePageResults pages={pages} checking />)
  expect(within(card('/queued')).getByText(C.pageWaiting)).toBeVisible()
  expect(within(card('/checking')).getByText(C.pageChecking)).toBeVisible()
  expect(within(card('/failed')).getByText(C.checkIncomplete)).toBeVisible()
  rendered.rerender(<SitePageResults pages={pages} checking={false} />)
  expect(screen.queryByText(C.pageWaiting)).not.toBeInTheDocument()
  expect(screen.queryByText(C.pageChecking)).not.toBeInTheDocument()
  expect(screen.getAllByText(C.checkIncomplete)).toHaveLength(3)
})

it('uses a calm completed view only after every unflagged page is complete', () => {
  const rendered = render(<SitePageResults pages={[page('/waiting', 'QUEUED')]} checking />)
  expect(screen.getByText('/waiting')).toBeVisible()
  rendered.rerender(<SitePageResults pages={[page('/waiting')]} />)
  expect(screen.getByRole('heading', { name: C.noPageFlags })).toBeVisible()
  expect(screen.queryByText(C.checkIncomplete)).not.toBeInTheDocument()
  expect(screen.getByText('/waiting')).not.toBeVisible()
  fireEvent.click(screen.getByText(C.otherPages(1), { selector: 'summary' }))
  expect(within(card('/waiting')).getByText(C.checked)).toBeVisible()
})

it('does not claim a clear page result when no page evidence exists', () => {
  render(<SitePageResults pages={[]} />)
  expect(screen.getByRole('heading', { name: C.noRecordedPages })).toBeVisible()
  expect(screen.queryByText(C.noPageFlags)).not.toBeInTheDocument()
})

it('takes live activity from the Site analysis rather than a retained page status', () => {
  const view = siteViewFixture()
  view.audit.status = 'CHECKING'
  view.checkedPages = [{ url: 'https://example.com/', title: 'Home', status: 'QUEUED', checkedAt: '2026-11-03T00:00:00Z' }]
  const rendered = render(<SitePages siteId="fixture-site" view={view} onOpenFlag={() => {}} />)
  expect(screen.getByText(C.pageWaiting)).toBeVisible()
  rendered.rerender(<SitePages siteId="fixture-site" view={{ ...view, audit: { ...view.audit, status: 'FAILED' } }} onOpenFlag={() => {}} />)
  expect(screen.queryByText(C.pageWaiting)).not.toBeInTheDocument()
  expect(screen.getByText(C.checkIncomplete)).toBeVisible()
})
