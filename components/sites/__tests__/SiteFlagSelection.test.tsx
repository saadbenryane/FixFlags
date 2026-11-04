import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SiteFlagSelection, SiteFlagSelectionCheckbox } from '../SiteFlagSelection'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import type { SiteCardArea } from '@/lib/sites/card-areas'

const flags = [{ id: 'shared' }, { id: 'other' }]

function Selection({ siteId = 'first', area }: { siteId?: string; area?: SiteCardArea }) {
  return <SiteFlagSelection siteId={siteId} area={area} flags={flags} availability="available">
    <SiteFlagSelectionCheckbox flagId="shared" title="Shared issue" />
    <SiteFlagSelectionCheckbox flagId="other" title="Other issue" />
  </SiteFlagSelection>
}

it.each([
  { name: 'Site', before: { siteId: 'first' }, after: { siteId: 'second' } },
  { name: 'category', before: { area: 'performance' as const }, after: { area: 'accessibility' as const } },
])('starts a new repair selection when the $name changes', ({ before, after }) => {
  const rendered = render(<Selection {...before} />)
  fireEvent.click(screen.getByRole('button', { name: C.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: C.selectFlag('Shared issue') }))
  expect(screen.getByText(C.selectedCount(1))).toBeVisible()

  rendered.rerender(<Selection {...after} />)
  expect(screen.getByRole('button', { name: C.selectFlags })).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

  rendered.rerender(<Selection {...before} />)
  fireEvent.click(screen.getByRole('button', { name: C.selectFlags }))
  expect(screen.getByRole('checkbox', { name: C.selectFlag('Shared issue') })).not.toBeChecked()
  expect(screen.getByText(C.selectedCount(0))).toBeVisible()
})

it('keeps nested page and finding groups in the outer repair selection', () => {
  const content = (area: SiteCardArea) => <SiteFlagSelection siteId="site" flags={flags} availability="available">
    <SiteFlagSelectionCheckbox flagId="shared" title="Shared issue" />
    <SiteFlagSelection siteId="site" area={area} flags={flags} availability="available">
      <SiteFlagSelectionCheckbox flagId="shared" title="Shared issue on another page" />
    </SiteFlagSelection>
  </SiteFlagSelection>
  const rendered = render(content('performance'))
  expect(screen.getAllByRole('button', { name: C.selectFlags })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: C.selectFlags }))
  fireEvent.click(screen.getByRole('checkbox', { name: C.selectFlag('Shared issue') }))

  rendered.rerender(content('accessibility'))
  expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  expect(screen.getByRole('checkbox', { name: C.selectFlag('Shared issue on another page') })).toBeChecked()
  expect(screen.getByText(C.selectedCount(1))).toBeVisible()
})
