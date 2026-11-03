import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SiteCardFindings } from '../SiteCardFindings'
import { SitePerformanceFindings } from '../SitePerformanceFindings'
import { SitePages } from '../SitePages'
import { SiteCategoryDetails } from '../SiteCategoryDetails'
import { ProductBoardCard } from '../BoardCard'
import { SitePromptCopyButton } from '../SitePromptCopyButton'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { buildBoardCards } from '@/lib/sites/board-card'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY as B } from '@/lib/marketing/copy/terminology'

const first = siteFlagFixture({ id: 'incident-one', sourceFlagId: 'source-one', problem: 'First slow page',
  area: 'performance', checkId: 'lcp-critical', fix: 'Inspect the main content delivery.', repairGuidance: 'ready' })
const other = siteFlagFixture({ ...first, id: 'incident-two', sourceFlagId: 'source-two', problem: 'Second slow page',
  pageUrl: 'https://example.com/pricing', affectedPaths: ['https://example.com/pricing'], priorityBand: 'other' })
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string)
    const prompt = `Read the repair details at https://fixflags.test/sites/site/flags/incident-one. Preserve each page and device.`
    if (url.endsWith('/fix-prompt')) return Response.json({ ok: true, prompt, tasks: [
      { sourceFlagId: 'source-one', referenceFlagId: 'incident-one', promptHash: 'a'.repeat(64) },
      { sourceFlagId: 'source-two', referenceFlagId: 'incident-two', promptHash: 'b'.repeat(64) },
    ] })
    if (body.action === 'prepare') return Response.json({ ok: true, prompt, sourceFlagId: 'source-one', referenceFlagId: 'incident-one', promptHash: 'a'.repeat(64) })
    return Response.json({ ok: true, prompt, handoff: { flagId: 'source-one', action: 'HANDOFF_COPIED', improvementId: 'incident-one', sourceReviewId: 'scan' } })
  }))
})
afterEach(() => vi.unstubAllGlobals())

it('copies a finding directly beside View Flag, keeping its incident scope and leaving the detail closed', async () => {
  const open = vi.fn()
  render(<SiteCardFindings siteId="site" flags={[first]} recommendations={[]} onOpenFlag={open} />)
  const row = screen.getByRole('heading', { name: first.problem }).closest('li')!
  expect(within(row).getByRole('button', { name: C.viewFlag })).toBeVisible()
  fireEvent.click(within(row).getByRole('button', { name: B.promptActionFor(B.copyPrompt, first.problem) }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
  expect(open).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith('/api/sites/site/flags/incident-one/fix', expect.objectContaining({ body: JSON.stringify({ action: 'prepare' }) }))
  expect(fetch).not.toHaveBeenCalledWith('/api/sites/site/flags/source-one/fix', expect.anything())
})

it('copies all Performance flags across pages and priority groups without opening a prompt preview', async () => {
  render(<SitePerformanceFindings siteId="site" flags={[first, other]} availability="available" />)
  expect(screen.getAllByRole('button', { name: C.fixAll })).toHaveLength(1)
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: C.fixAll }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
  expect(fetch).toHaveBeenCalledWith('/api/sites/site/fix-prompt', expect.objectContaining({ body: JSON.stringify({ area: 'performance' }) }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site/flags/incident-two/fix', expect.objectContaining({ body: JSON.stringify({ action: 'copy', promptHash: 'b'.repeat(64) }) })))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps per-finding copy visible during selection and copies every page of a paginated list', async () => {
  const flags = Array.from({ length: 8 }, (_, i) => ({ ...first, id: `incident-${i}`, problem: `Slow page ${i}` }))
  render(<SiteCardFindings siteId="site" flags={flags} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: C.fixAll }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site/fix-prompt', expect.objectContaining({
    body: JSON.stringify({ flagIds: flags.map(flag => flag.id) }),
  })))
  fireEvent.click(screen.getByRole('button', { name: C.selectFlags }))
  expect(screen.getByRole('button', { name: B.promptActionFor(B.copyPrompt, flags[0].problem) })).toBeVisible()
  expect(screen.getAllByRole('checkbox')).toHaveLength(6)
})

it('offers both copy actions to a signed-out visitor without requesting private repair data', () => {
  render(<SiteCardFindings siteId="site" flags={[{ ...first, fix: '', repairGuidance: 'unavailable' }]} recommendations={[]} copyAvailability="sign_in" />)
  expect(screen.getByRole('link', { name: C.fixAll })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite')
  expect(screen.getByRole('link', { name: B.copyPrompt })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite%2Fflags%2Fincident-one')
  expect(screen.getByRole('link', { name: C.viewFlag })).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()
})

it('gives each page a direct copy action for its actual finding', async () => {
  const view = siteViewFixture()
  view.flags = [first, other]
  const open = vi.fn()
  render(<SitePages siteId="site" view={view} onOpenFlag={open} />)
  const row = screen.getByRole('button', { name: C.open(first.problem) }).closest('li')!
  fireEvent.click(within(row).getByRole('button', { name: B.promptActionFor(B.copyPrompt, first.problem) }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
  expect(open).not.toHaveBeenCalled()
})

it('shows one category copy-all before the findings and keeps it scoped to Performance', async () => {
  const view = siteViewFixture()
  view.flags = [first, other]
  const selected = buildBoardCards({ siteId: 'site', inFlight: false, hasLastKnown: true,
    health: { state: 'attention', answer: 'Needs attention', statusLabel: 'Needs attention' }, coverageByArea: new Map(),
    flags: view.flags, outcomes: [], pageCount: 2, captureUrl: null, checkedAt: null }).find(card => card.id === 'performance')!
  render(<SiteCategoryDetails selected={selected} selectedFlags={view.flags} selectedRecommendations={[]} confirmedOutcomes={[]}
    findingPages={2} siteId="site" view={view} busy={false} checkAction={() => null} verifyOutcome={vi.fn()}
    onClose={vi.fn()} restoreFocus={vi.fn()} />)
  expect(screen.getAllByRole('button', { name: C.fixAll })).toHaveLength(1)
  const all = screen.getByRole('button', { name: C.fixAll })
  const title = screen.getByRole('heading', { name: first.problem })
  expect(all.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(all)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site/fix-prompt', expect.objectContaining({ body: JSON.stringify({ area: 'performance' }) })))
})

it.each(['card', 'row'] as const)('keeps overview %s copy separate from category and finding navigation', async layout => {
  const card = buildBoardCards({ siteId: 'site', inFlight: false, hasLastKnown: true,
    health: { state: 'attention', answer: 'Needs attention', statusLabel: 'Needs attention' }, coverageByArea: new Map(),
    flags: [first], outcomes: [], pageCount: 1, captureUrl: null, checkedAt: null }).find(item => item.id === 'performance')!
  const category = vi.fn(), open = vi.fn()
  render(<ProductBoardCard compact layout={layout} card={card} onOpen={category} onOpenFlag={open}
    renderFlagCopy={flag => <SitePromptCopyButton siteId="site" flagId={flag.id} flagTitle={flag.title} compact />} />)
  const copy = screen.getByRole('button', { name: B.promptActionFor(B.copyPrompt, first.problem) })
  expect(copy.parentElement?.closest('button, a')).toBeNull()
  fireEvent.click(copy)
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
  expect(category).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()
})
