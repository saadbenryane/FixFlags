import { render, screen, fireEvent } from '@testing-library/react'
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
