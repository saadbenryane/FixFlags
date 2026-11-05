import { render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SitePages } from '../SitePages'
import { SitePerformanceFindings } from '../SitePerformanceFindings'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SiteCardFindings } from '../SiteCardFindings'
import { siteFlagFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

afterEach(() => vi.unstubAllGlobals())

it('opens a Flag from its named title and preserves the actual control for focus restoration', () => {
  const flag = siteFlagFixture({ problem: 'Customers cannot finish the contact form' })
  const open = vi.fn()
  render(<SiteCardFindings siteId="site-1" flags={[flag]} recommendations={[]} onOpenFlag={open} />)
  const heading = screen.getByRole('heading', { name: flag.problem! })
  const action = within(heading).getByRole('link', { name: flag.problem! })
  expect(action).toHaveAttribute('href', `/sites/site-1/flags/${flag.id}`)
  expect(screen.queryByRole('button', { name: SITE_DASHBOARD_COPY.viewFlag })).not.toBeInTheDocument()
  fireEvent.click(action)
  expect(open).toHaveBeenCalledExactlyOnceWith(flag.id, action)
})

it('keeps a native Flag destination when no in-place opener is supplied', () => {
  const flag = siteFlagFixture({ id: 'flag-1', problem: 'The contact form failed' })
  render(<SiteCardFindings siteId="site-1" flags={[flag]} recommendations={[]} />)
  const heading = screen.getByRole('heading', { name: flag.problem! })
  expect(within(heading).getByRole('link', { name: flag.problem! })).toHaveAttribute('href', '/sites/site-1/flags/flag-1')
  expect(screen.queryByRole('link', { name: SITE_DASHBOARD_COPY.viewFlag })).not.toBeInTheDocument()
})

it('selects and previews a repair without opening the surrounding Flag row', async () => {
  const flag = siteFlagFixture({ problem: 'A missing contact destination',
    fix: 'Restore the recorded contact destination and check that the form reaches it.' })
  const other = siteFlagFixture({ id: 'another', problem: 'Another issue' })
  const open = vi.fn()
  const fetcher = vi.fn(async () => Response.json({ ok: true, prompt: 'Repair the recorded contact destination.',
    sourceFlagId: flag.id, promptHash: 'a'.repeat(64) }))
  vi.stubGlobal('fetch', fetcher)
  render(<SiteCardFindings siteId="site-1" flags={[flag, other]} recommendations={[]} onOpenFlag={open} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: SITE_DASHBOARD_COPY.selectFlag(flag.problem!) }))
  expect(screen.getByText(SITE_DASHBOARD_COPY.selectedCount(1))).toBeVisible()
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.promptActionFor(SITE_BOARD_COPY.viewPrompt, flag.problem!) }))
  expect(await screen.findByRole('textbox')).toHaveValue('Repair the recorded contact destination.')
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/sites/site-1/flags/flag-1/fix', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ action: 'prepare' }),
  }))
  expect(open).not.toHaveBeenCalled()
})

it('keeps sign-in access separate from missing guidance without exposing a fix', () => {
  render(<SiteCardFindings siteId="site-1" copyAvailability="sign_in" flags={[
    siteFlagFixture({ fix: '', repairGuidance: 'unavailable' }),
  ]} recommendations={[]} />)
  expect(screen.queryByText(SITE_ACTION_COPY.repairGuidance.label.unavailable)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: SITE_BOARD_COPY.copyPrompt })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite-1%2Fflags%2Fflag-1')
})
it('retains an explicit selection across priority groups and prepares only those tasks', async () => {
  const fetchMock = vi.fn(async () => Response.json({ ok: true, prompt: 'Two selected fixes.', tasks: [
    { sourceFlagId: 'a', promptHash: 'a'.repeat(64) }, { sourceFlagId: 'c', promptHash: 'c'.repeat(64) },
  ] }))
  vi.stubGlobal('fetch', fetchMock)
  render(<SiteCardFindings siteId="site-1" flags={[
    siteFlagFixture({ id: 'a', problem: 'First urgent issue' }),
    siteFlagFixture({ id: 'b', problem: 'Another urgent issue' }),
    siteFlagFixture({ id: 'c', problem: 'Smaller issue', priorityBand: 'other' }),
  ]} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select Flags' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select First urgent issue' }))
  const other = screen.getAllByRole('tab').find(tab => tab.textContent?.includes('Other'))!
  fireEvent.click(other)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Smaller issue' }))
  expect(screen.getByText('2 selected')).toBeVisible()
  expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixSelected(2) })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.viewPrompt }))
  expect(await screen.findByRole('textbox')).toHaveValue('Two selected fixes.')
  expect(fetchMock).toHaveBeenCalledWith('/api/sites/site-1/fix-prompt', expect.objectContaining({ body: JSON.stringify({ flagIds: ['a', 'c'] }) }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('counts a shared Flag once while its checkbox stays synchronized across Pages', () => {
  const view = siteViewFixture()
  view.flags = [siteFlagFixture({ problem: 'Shared issue', affectedPaths: ['https://example.com/', 'https://example.com/pricing'] }), siteFlagFixture({ id: 'other', problem: 'Separate issue' })]
  render(<SitePages siteId="site-1" view={view} onOpenFlag={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select Flags' }))
  const boxes = screen.getAllByRole('checkbox', { name: 'Select Shared issue' })
  expect(boxes).toHaveLength(2)
  fireEvent.click(boxes[0])
  expect(boxes.every(box => box.getAttribute('aria-checked') === 'true')).toBe(true)
  expect(screen.getByText('1 selected')).toBeVisible()
  fireEvent.click(boxes[1])
  expect(screen.getByText('0 selected')).toBeVisible()
})

it('keeps cancellation available when live recovery leaves only one Flag', () => {
  const first = siteFlagFixture({ id: 'first', problem: 'First issue' })
  const second = siteFlagFixture({ id: 'second', problem: 'Second issue' })
  const rendered = render(<SiteCardFindings siteId="site-1" flags={[first, second]} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select First issue' }))
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={[first]} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.cancelSelection }))
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixAll })).toBeEnabled()
})

it('retires recovered selections without losing the remaining choice or adding a returning Flag', async () => {
  const flags = ['a', 'b', 'c'].map(id => siteFlagFixture({ id, problem: `Issue ${id}` }))
  const fetchMock = vi.fn(async () => Response.json({ ok: true, prompt: 'Only the remaining selected fix.',
    tasks: [{ sourceFlagId: 'b', promptHash: 'b'.repeat(64) }] }))
  vi.stubGlobal('fetch', fetchMock)
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Issue a' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Issue b' }))
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.slice(1)} recommendations={[]} />)
  expect(screen.getByText('1 selected')).toBeVisible()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  expect(screen.getByRole('checkbox', { name: 'Select Issue a' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Select Issue b' })).toBeChecked()
  expect(screen.getByText('1 selected')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.viewPrompt }))
  expect(await screen.findByRole('textbox')).toHaveValue('Only the remaining selected fix.')
  expect(fetchMock).toHaveBeenCalledWith('/api/sites/site-1/fix-prompt', expect.objectContaining({ body: JSON.stringify({ flagIds: ['b'] }) }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('finishes selection when the last current Flag recovers and starts a returning list unselected', () => {
  const flags = ['a', 'b'].map(id => siteFlagFixture({ id, problem: `Issue ${id}` }))
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Issue a' }))
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={[]} recommendations={[]} />)
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.selectFlags })).toBeEnabled()
  expect(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.fixAll })).toBeEnabled()
})
it('uses one selection scope across performance page and device groups', () => {
  render(<SitePerformanceFindings siteId="site-1" availability="available" flags={[
    siteFlagFixture({ id: 'one', problem: 'First page issue', pageUrl: 'https://example.com/' }),
    siteFlagFixture({ id: 'two', problem: 'Second page issue', pageUrl: 'https://example.com/pricing' }),
  ]} />)
  expect(screen.getAllByRole('button', { name: 'Select Flags' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Select Flags' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select First page issue' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second page issue' }))
  expect(screen.getByText('2 selected')).toBeVisible()
})

function findings(prefix: string, count = 8, priorityBand: 'fix_first' | 'other' = 'fix_first') {
  return Array.from({ length: count }, (_, index) => siteFlagFixture({ id: `${prefix}-${index}`,
    problem: `${prefix} issue ${index + 1}`, priorityBand }))
}

it('focuses the new page of Flags only for explicit pagination and announces the range', () => {
  render(<SiteCardFindings siteId="site-1" flags={findings('Recorded')} recommendations={[]} />)
  const next = screen.getByRole('button', { name: SITE_DASHBOARD_COPY.next })
  const panel = document.getElementById(next.getAttribute('aria-controls')!)!
  expect(within(panel).getByRole('heading', { name: 'Recorded issue 1' })).toBeVisible()
  fireEvent.click(next)
  expect(screen.getByRole('heading', { name: 'Recorded issue 7' })).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent(SITE_DASHBOARD_COPY.range(7, 8, 8))
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.previous }))
  expect(screen.getByRole('heading', { name: 'Recorded issue 1' })).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent(SITE_DASHBOARD_COPY.range(1, 6, 8))
})

it('retires a clamped page without moving outside focus or restoring it when the list grows', () => {
  const flags = findings('Recorded')
  const view = (current: typeof flags) => <><button>Monitoring controls</button><SiteCardFindings siteId="site-1" flags={current} recommendations={[]} /></>
  const rendered = render(view(flags))
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.next }))
  const outside = screen.getByRole('button', { name: 'Monitoring controls' })
  outside.focus()
  rendered.rerender(view(flags.slice(0, 4)))
  expect(outside).toHaveFocus()
  expect(screen.getByRole('heading', { name: 'Recorded issue 1' })).toBeVisible()
  rendered.rerender(view(flags))
  expect(outside).toHaveFocus()
  expect(screen.getByRole('heading', { name: 'Recorded issue 1' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Recorded issue 7' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(SITE_DASHBOARD_COPY.range(1, 6, 8))
})

it('starts a replacement priority group at its first page and does not jump back when problems return', () => {
  const urgent = findings('Urgent'), other = findings('Other', 8, 'other')
  const rendered = render(<SiteCardFindings siteId="site-1" flags={[...urgent, ...other]} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.next }))
  expect(screen.getByRole('heading', { name: 'Urgent issue 7' })).toBeVisible()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={other} recommendations={[]} />)
  expect(screen.getByRole('heading', { name: 'Other issue 1' })).toBeVisible()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={[...urgent, ...other]} recommendations={[]} />)
  expect(screen.getByRole('tab', { name: /Other/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: 'Other issue 1' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Urgent issue 7' })).not.toBeInTheDocument()
})

it('keeps keyboard focus on the priority tabs and resets pagination when changing groups', () => {
  render(<SiteCardFindings siteId="site-1" flags={[...findings('Urgent'), ...findings('Other', 1, 'other')]} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.next }))
  const [urgent, other] = screen.getAllByRole('tab')
  urgent.focus()
  fireEvent.keyDown(urgent, { key: 'ArrowRight' })
  expect(other).toHaveFocus()
  expect(other).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: 'Other issue 1' })).toBeVisible()
  fireEvent.keyDown(other, { key: 'Home' })
  expect(urgent).toHaveFocus()
  expect(urgent).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: 'Urgent issue 1' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Urgent issue 7' })).not.toBeInTheDocument()
})

it('keeps both priority tabs linked to their panels while loading only the selected findings', () => {
  render(<SiteCardFindings siteId="site-1" flags={[...findings('Urgent', 1), ...findings('Other', 1, 'other')]} recommendations={[]} />)
  const tabs = screen.getAllByRole('tab')
  function expectLinkedPanels() {
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
      expect(panel!.hidden).toBe(tab.getAttribute('aria-selected') !== 'true')
    }
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  }
  expectLinkedPanels()
  expect(screen.queryByRole('heading', { name: 'Other issue 1' })).not.toBeInTheDocument()
  tabs[0].focus()
  fireEvent.keyDown(tabs[0], { key: 'End' })
  expect(tabs[1]).toHaveFocus()
  expectLinkedPanels()
  expect(screen.getByRole('heading', { name: 'Other issue 1' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Urgent issue 1' })).not.toBeInTheDocument()
})

it('keeps the current device group page when another performance group recovers', () => {
  const desktop = findings('Desktop', 1).map(flag => ({ ...flag, checkId: 'lcp-critical' }))
  const mobile = findings('Mobile').map(flag => ({ ...flag, checkId: 'mobile-lcp-critical' }))
  const rendered = render(<SitePerformanceFindings siteId="site-1" availability="available" flags={[...desktop, ...mobile]} />)
  const mobileGroup = screen.getByRole('heading', { name: SITE_ACTION_COPY.execution.devices.mobile }).closest('section')!
  fireEvent.click(within(mobileGroup).getByRole('button', { name: SITE_DASHBOARD_COPY.next }))
  expect(screen.getByRole('heading', { name: 'Mobile issue 7' })).toHaveFocus()
  rendered.rerender(<SitePerformanceFindings siteId="site-1" availability="available" flags={mobile} />)
  expect(screen.getByRole('heading', { name: 'Mobile issue 7' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Mobile issue 7' })).toHaveFocus()
  expect(screen.queryByRole('heading', { name: 'Mobile issue 1' })).not.toBeInTheDocument()
})

it('keeps a recovered finding in place in the keyboard reading order', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const flags = findings('Recorded', 4)
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  screen.getByRole('link', { name: 'Recorded issue 2' }).focus()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.filter(flag => flag.id !== flags[1].id)} recommendations={[]} />)
  expect(screen.getByRole('heading', { name: 'Recorded issue 3' })).toHaveFocus()
  expect(fetch).not.toHaveBeenCalled()
})

it('returns to the remaining page when the focused final page recovers', () => {
  const flags = findings('Recorded')
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  fireEvent.click(screen.getByRole('button', { name: SITE_DASHBOARD_COPY.next }))
  screen.getByRole('link', { name: 'Recorded issue 8' }).focus()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.slice(0, 4)} recommendations={[]} />)
  expect(screen.getByRole('heading', { name: 'Recorded issue 1' })).toHaveFocus()
})

it('leaves a surviving control focused when another finding recovers', () => {
  const flags = findings('Recorded', 4)
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  const link = screen.getByRole('link', { name: 'Recorded issue 3' })
  link.focus()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.slice(1)} recommendations={[]} />)
  expect(link).toHaveFocus()
})

it('follows the current reading position after earlier findings have already recovered', () => {
  const flags = findings('Recorded', 6)
  const rendered = render(<SiteCardFindings siteId="site-1" flags={flags} recommendations={[]} />)
  const link = screen.getByRole('link', { name: 'Recorded issue 3' })
  link.focus()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.slice(2)} recommendations={[]} />)
  expect(link).toHaveFocus()
  rendered.rerender(<SiteCardFindings siteId="site-1" flags={flags.slice(3)} recommendations={[]} />)
  expect(screen.getByRole('heading', { name: 'Recorded issue 4' })).toHaveFocus()
})
