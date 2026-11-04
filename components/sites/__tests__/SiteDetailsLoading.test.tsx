import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { SiteCategoryDetails } from '../SiteCategoryDetails'
import { SiteFlagPanel } from '../SiteFlagPanel'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { buildBoardCards } from '@/lib/sites/board-card'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

const read = vi.hoisted(() => vi.fn())
// Keep the content download pending while exercising the real dialog shell.
vi.mock('next/dynamic', () => ({ default: (_loader: unknown, options: { loading: () => unknown }) => options.loading }))
vi.mock('@/hooks/useSiteFlagDetail', () => ({ useSiteFlagDetail: read }))
beforeEach(() => { read.mockReset().mockReturnValue({ data: null, failed: false, stale: false, refreshing: true, retry: vi.fn() }) })

function categoryFixture() {
  const view = siteViewFixture()
  view.flags = [siteFlagFixture()]
  const selected = buildBoardCards({ siteId: view.site.siteId, inFlight: false, hasLastKnown: true,
    health: { state: 'attention', answer: 'Needs attention', statusLabel: 'Needs attention' }, coverageByArea: new Map(),
    flags: view.flags, outcomes: [], pageCount: 1, captureUrl: null, checkedAt: null }).find(card => card.id === 'conversion')!
  return { view, selected }
}

it('opens, focuses, and dismisses a category before its content module is available', async () => {
  const { view, selected } = categoryFixture()
  const checkAction = vi.fn()
  function Example() {
    const [open, setOpen] = useState(false)
    const opener = useRef<HTMLButtonElement>(null)
    return <><button ref={opener} onClick={() => setOpen(true)}>Open category</button>
      {open ? <SiteCategoryDetails selected={selected} selectedFlags={view.flags} selectedRecommendations={[]}
        confirmedOutcomes={[]} findingPages={1} siteId={view.site.siteId} view={view} busy={false}
        checkAction={checkAction} verifyOutcome={vi.fn()} onClose={() => setOpen(false)} restoreFocus={() => opener.current?.focus()} /> : null}</>
  }
  render(<Example />)
  const opener = screen.getByRole('button', { name: 'Open category' })
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Conversion' })
  expect(within(dialog).getByRole('status')).toHaveTextContent(SITE_ACTION_COPY.loading)
  expect(within(dialog).getByRole('heading', { name: 'Conversion' })).toHaveFocus()
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(opener).toHaveFocus())
})

it('keeps known incomplete evidence and its recovery action available while deeper content loads', () => {
  const { view, selected } = categoryFixture()
  const retry = vi.fn()
  render(<SiteCategoryDetails selected={{ ...selected, state: 'unknown', incompleteReason: 'The recorded check could not finish' }}
    selectedFlags={view.flags} selectedRecommendations={[]} confirmedOutcomes={[]} findingPages={1}
    siteId={view.site.siteId} view={view} busy={false} checkAction={area => <button onClick={() => retry(area)}>Retry category</button>}
    verifyOutcome={vi.fn()} onClose={vi.fn()} restoreFocus={vi.fn()} />)
  const dialog = screen.getByRole('dialog', { name: 'Conversion' })
  expect(within(dialog).getByText(/The recorded check could not finish/)).toBeVisible()
  expect(within(dialog).getByRole('status')).toHaveTextContent(SITE_ACTION_COPY.loading)
  expect(retry).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Retry category' }))
  expect(retry).toHaveBeenCalledExactlyOnceWith('conversion')
})

it('starts the Flag read and exposes Back and full details before its content module is available', () => {
  const view = siteViewFixture()
  const flag = siteFlagFixture({ problem: 'The contact destination is unavailable' })
  view.flags = [flag]
  const close = vi.fn()
  render(<SiteFlagPanel siteId={view.site.siteId} flagId={flag.id} view={view} onClose={close} restoreFocus={vi.fn()} returnLabel="Pages" />)
  const dialog = screen.getByRole('dialog', { name: flag.problem })
  expect(within(dialog).getByRole('status')).toHaveTextContent(C.loadingFlag)
  expect(read).toHaveBeenCalledWith(view.site.siteId, flag.id, expect.any(String), true)
  expect(within(dialog).getByRole('link', { name: C.fullFlag })).toHaveAttribute('href', `/sites/${view.site.siteId}/flags/${flag.id}`)
  fireEvent.click(within(dialog).getByRole('button', { name: C.backTo('Pages') }))
  expect(close).toHaveBeenCalledOnce()
})
