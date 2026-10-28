import { fireEvent, render as renderView, screen, waitFor, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SitePageResults } from '../SitePageResults'
import { SitePages } from '../SitePages'
import { SiteFlagPanel } from '../SiteFlagPanel'
import { SiteFixBundleButton } from '../SiteFixBundleButton'
import { MAX_REPAIR_TASKS } from '@/lib/sites/repair-scope'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { siteScopeCounts } from '@/lib/sites/scope-counts'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

vi.mock('../SiteFlagActions', () => ({ SiteFlagActions: () => <button>Owner fix actions</button> }))
function render(element: ReactNode) {
  const cache = new Map()
  return renderView(element, { wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig> })
}
const flag = { id: 'flag-1', sourceFlagId: 'source-1', problem: 'A missing description', area: 'search',
  pageUrl: 'https://example.com/pricing', affectedPaths: ['https://example.com/pricing', 'https://example.com/about'],
  affectedPageCount: 2, priorityBand: 'other', whyItMatters: 'Explain the page', fix: 'Add a description', repairGuidance: 'ready' } as SiteFlagSeed
function view(owner = false) {
  const checkedPages = [{ url: flag.affectedPaths[0], title: 'Pricing', status: 'COMPLETED', checkedAt: '2026-10-24T00:00:00Z' },
    { url: flag.affectedPaths[1], title: 'About', status: 'COMPLETED', checkedAt: '2026-10-24T00:00:00Z' }]
  return { flags: [flag], resolvedFlags: [], checkedPages, counts: siteScopeCounts([flag], checkedPages, 2), actions: siteViewerActions(owner) } as SiteHomeView
}
const detail = { flag: { ...flag, sourceAuditId: 'audit', evidence: 'Description is absent in the rendered page.', evidenceMissing: false,
  expectedBehavior: 'A unique description is rendered.', viewport: null, supportingObservations: [], supportingEvidenceUnreadable: false,
  performanceEvidenceSource: null, verifying: false, status: 'OPEN' }, capture: null }
afterEach(() => vi.unstubAllGlobals())
describe('dashboard reading and handoff', () => {
  it('shows affected pages first and keeps other pages collapsed without borrowing captures', () => {
    const open = vi.fn()
    render(<SitePageResults pages={[
      { url: 'https://example.com/problem', label: '/problem', status: 'COMPLETED', flags: [{ id: 'one', title: 'Page is unavailable', onOpen: open }] },
      { url: 'https://example.com/about', label: '/about', status: 'COMPLETED', flags: [] },
    ]} />)
    expect(screen.getByRole('heading', { level: 2, name: '1 page needs attention' })).toBeVisible()
    expect(screen.getByText('/about')).not.toBeVisible()
    fireEvent.click(screen.getByText('1 other page', { selector: 'summary' }))
    expect(screen.getByText('/about')).toBeVisible()
    expect(screen.getAllByText('No screenshot recorded')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Open Page is unavailable' }))
    expect(open).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })

  it('counts a shared Flag on both pages and opens it in place', () => {
    const open = vi.fn()
    render(<SitePages siteId="site" view={view()} onOpenFlag={open} />)
    expect(screen.getAllByText('1 Flag')).toHaveLength(2)
    expect(screen.getAllByText('No screenshot recorded')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: `Open ${flag.problem}` })[1])
    expect(open).toHaveBeenCalledWith('flag-1', expect.any(HTMLButtonElement))
  })
  it('loads evidence for an authorized visitor and gates only fix actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(detail)))
    render(<SiteFlagPanel siteId="site" flagId="flag-1" view={view()} onClose={vi.fn()} restoreFocus={vi.fn()} />)
    expect(await screen.findByText(detail.flag.evidence)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Copy fix prompt' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite%3Fflag%3Dflag-1')
    expect(screen.queryByRole('button', { name: 'Owner fix actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Full details and history' })).toHaveAttribute('href', '/sites/site/flags/flag-1')
  })
  it('ignores evidence arriving after another Flag has been opened', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockResolvedValueOnce(Response.json({ ...detail, flag: { ...detail.flag, id: 'second', problem: 'Second problem', evidence: 'Second evidence' } })))
    const result = render(<SiteFlagPanel siteId="site" flagId="flag-1" view={view(true)} onClose={vi.fn()} restoreFocus={vi.fn()} />)
    result.rerender(<SiteFlagPanel siteId="site" flagId="second" view={view(true)} onClose={vi.fn()} restoreFocus={vi.fn()} />)
    expect(await screen.findByText('Second evidence')).toBeVisible()
    finish(Response.json(detail))
    await waitFor(() => expect(screen.queryByText(detail.flag.evidence)).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Owner fix actions' })).toBeVisible()
  })
  it('exposes a failed lifecycle refresh beside retained dated evidence and allows retry', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(detail)).mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ...detail, flag: { ...detail.flag, status: 'FIXED' } }))
    vi.stubGlobal('fetch', fetch)
    const initial = view(true)
    const rendered = render(<SiteFlagPanel siteId="site" flagId="flag-1" view={initial} onClose={vi.fn()} restoreFocus={vi.fn()} />)
    expect(await screen.findByText(detail.flag.evidence)).toBeVisible()
    rendered.rerender(<SiteFlagPanel siteId="site" flagId="flag-1" view={{ ...initial, flags: [], resolvedFlags: [{ ...flag, status: 'FIXED' } as SiteFlagSeed] }} onClose={vi.fn()} restoreFocus={vi.fn()} />)
    expect(await screen.findByText('We couldn’t refresh this Flag. Showing the previous recorded observation.')).toBeVisible()
    expect(screen.getByText(detail.flag.evidence)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: SITE_ACTION_COPY.retryResults }))
    expect(await screen.findByText('This Flag is resolved. The observation below is from before the fix.')).toBeVisible()
  })
  it('previews a category bundle without recording handoffs', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, prompt: 'Full category prompt', tasks: [{ sourceFlagId: 'source-1', promptHash: 'a'.repeat(64) }] }))
    vi.stubGlobal('fetch', fetch)
    render(<SiteFixBundleButton siteId="site" area="search" availability="available" />)
    fireEvent.click(screen.getByRole('button', { name: 'View prompt' }))
    expect(await screen.findByRole('textbox', { name: 'Fix prompt' })).toHaveValue('Full category prompt')
    expect(writeText).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('explains an oversized explicit selection before requesting or copying any tasks', () => {
    const fetch = vi.fn(), writeText = vi.fn()
    vi.stubGlobal('fetch', fetch)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const flagIds = Array.from({ length: MAX_REPAIR_TASKS + 1 }, (_, index) => `flag-${index}`)
    const rendered = render(<SiteFixBundleButton siteId="site" flagIds={flagIds} availability="available" />)
    expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixSelected(flagIds.length) })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View prompt' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(`Select up to ${MAX_REPAIR_TASKS} Flags`)
    expect(fetch).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
    rendered.rerender(<SiteFixBundleButton siteId="site" flagIds={flagIds.slice(0, MAX_REPAIR_TASKS)} availability="available" />)
    expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixSelected(MAX_REPAIR_TASKS) })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'View prompt' })).toBeEnabled()
    expect(screen.queryByText(`Select up to ${MAX_REPAIR_TASKS} Flags to prepare one fix prompt.`)).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps an oversized expanded prompt disabled without preparing an unsupported scope', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const flagIds = Array.from({ length: MAX_REPAIR_TASKS + 1 }, (_, index) => `flag-${index}`)
    render(<SiteFixBundleButton siteId="site" flagIds={flagIds} availability="available" presentation="preview" />)
    expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixSelected(flagIds.length) })).toBeDisabled()
    expect(screen.getAllByText(`Select up to ${MAX_REPAIR_TASKS} Flags to prepare one fix prompt.`)[0]).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('copies a category bundle and acknowledges each original hash only after clipboard success', async () => {
    const writes: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async value => { writes.push(value) }) }, configurable: true })
    const fetch = vi.fn(async (url: string) => url.endsWith('/fix-prompt') ? Response.json({ ok: true, prompt: 'All original tasks', tasks: [{ sourceFlagId: 'source-1', promptHash: 'a'.repeat(64) }] })
      : Response.json({ ok: true, prompt: 'Task', handoff: { flagId: 'source-1', action: 'HANDOFF_COPIED', improvementId: 'i', sourceReviewId: 'a' } }))
    vi.stubGlobal('fetch', fetch)
    render(<SiteFixBundleButton siteId="site" area="search" availability="available" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy all fix prompts' }))
    expect(await screen.findByText('Fixes copied')).toBeVisible()
    expect(writes).toEqual(['All original tasks'])
    expect(fetch).toHaveBeenCalledWith('/api/sites/site/fix-prompt', expect.objectContaining({ body: JSON.stringify({ area: 'search' }) }))
    expect(fetch).toHaveBeenCalledWith('/api/sites/site/flags/source-1/fix', expect.objectContaining({ body: JSON.stringify({ action: 'copy', promptHash: 'a'.repeat(64) }) }))
  })
  it.each([422, 503])('shows a refused repair request and keeps copying available for an explicit retry: %s', async status => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const message = status === 422 ? 'Some selected Flags have no usable fix instructions.' : 'Fix preparation is unavailable. Try again.'
    const fetch = vi.fn().mockResolvedValue(Response.json({ message }, { status }))
    vi.stubGlobal('fetch', fetch)
    render(<SiteFixBundleButton siteId="site" availability="available" />)
    fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixAll }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixAll })).toBeEnabled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
  })
  it('offers manual copying without falsely recording a clipboard handoff', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, prompt: 'Full scoped prompt', tasks: [{ sourceFlagId: 'f', promptHash: 'a'.repeat(64) }] }))
    vi.stubGlobal('fetch', fetch)
    render(<SiteFixBundleButton siteId="site" availability="available" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy all fix prompts' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox')).toHaveValue('Full scoped prompt')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Fixes copied')).not.toBeInTheDocument()
  })
})
