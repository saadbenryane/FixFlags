import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SiteOverviewWorkspace } from '../SiteOverviewWorkspace'

it('leads with recorded scope and groups repair actions with the findings', () => {
  render(<SiteOverviewWorkspace summary={<section aria-label="Recorded context">Original capture and scope</section>}
    actions={<button>Review all fix prompts</button>}
    items={[{ id: 'security', flagCount: 2, render: () => <button>Inspect HTTPS Flag</button> },
      { id: 'search', flagCount: 0, render: () => <button>Inspect Search results</button> }]}
    uptime={<section aria-label="Uptime">Recorded uptime</section>} />)
  const flag = screen.getByRole('button', { name: 'Inspect HTTPS Flag' })
  const actions = screen.getByRole('group', { name: 'Website actions' })
  const context = screen.getByRole('region', { name: 'Recorded context' })
  expect(context.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(actions.compareDocumentPosition(flag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Needs attention' })).toContainElement(actions)
  expect(screen.getByRole('button', { name: 'Inspect Search results' })).toBeEnabled()
  expect(screen.getByRole('region', { name: 'Uptime' })).toBeInTheDocument()
})

it('keeps context and every category when there are no actionable Flags', () => {
  render(<SiteOverviewWorkspace summary={<p>No fresh capture recorded</p>}
    items={[{ id: 'search', flagCount: 0, render: () => <button>Inspect unchecked Search</button> }]} />)
  expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull()
  expect(screen.getByText('No fresh capture recorded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Inspect unchecked Search' })).toBeEnabled()
})
