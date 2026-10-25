import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SitePages } from '../SitePages'
import { SitePerformanceFindings } from '../SitePerformanceFindings'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SiteCardFindings } from '../SiteCardFindings'
import { siteFlagFixture } from '@/lib/sites/__tests__/site-view-fixture'

afterEach(() => vi.unstubAllGlobals())
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
  expect(screen.getByRole('button', { name: 'Copy 2 fix prompts' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'View prompt' }))
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
