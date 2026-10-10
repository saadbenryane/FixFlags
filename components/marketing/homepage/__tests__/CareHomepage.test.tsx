import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CareHomepage } from '../CareHomepage'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function openCategory(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Open ${name}` }))
  return screen.getByRole('dialog')
}

describe('comprehensive homepage experience', () => {
  it('keeps the brand, two URL entries and the sample-to-analysis path', () => {
    render(<CareHomepage />)
    expect(screen.getByRole('heading', { level: 1, name: /Your software runs\.\s*FixFlags watches\./ })).toBeVisible()
    expect(screen.getAllByTestId('url-entry')).toHaveLength(2)
    expect(screen.getByRole('link', { name: S.exploreAction })).toHaveAttribute('href', '#product')
    expect(screen.getByRole('link', { name: S.analyzeAction })).toHaveAttribute('href', '#analyze')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const board = screen.getByRole('region', { name: C.boardAria })
    for (const card of S.categories) expect(within(board).getByRole('button', { name: `Open ${card.name}` })).toBeVisible()
    expect(within(board).getAllByText('0 Flags')).toHaveLength(2)
    for (const state of ['Partial', 'Out of date', 'Not configured']) expect(within(board).getByText(state)).toBeVisible()
    expect(screen.queryByText('Add to this Site')).not.toBeInTheDocument()
  })

  it('makes all available result groups accessible, including recommendations and limits', () => {
    render(<CareHomepage />)
    const dialog = openCategory('Performance')
    expect(within(dialog).getByText('Unavailable')).toBeVisible()
    expect(within(dialog).getByText('Recommendation')).toBeVisible()
    expect(within(dialog).queryByText('0 Flags')).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/3\.1s/)).not.toBeInTheDocument()
  })

  it('keeps healthy results bounded to their evidence scope', () => {
    render(<CareHomepage />)
    const dialog = openCategory('Search')
    expect(within(dialog).getByText('Page titles')).toBeVisible()
    expect(within(dialog).getByText('Search rankings')).toBeVisible()
    expect(within(dialog).getByText('Outside coverage')).toBeVisible()
    expect(within(dialog).getByRole('link', { name: /Search Console context/ })).toHaveAttribute('href', '/integrations#search-console')
  })

  it('uses pricing HTTP evidence only for the availability Flag', () => {
    render(<CareHomepage />)
    let dialog = openCategory('Pages')
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: S.detailAction }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('img', { name: S.availabilityAlt })).toHaveAttribute('src', '/marketing/evidence/pricing-unavailable.png')
    expect(within(dialog).queryByRole('img', { name: C.flag.cropAlt })).not.toBeInTheDocument()
    expect(within(dialog).getByText(S.unresolved)).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: S.recoveryAction })).not.toBeInTheDocument()
  })

  it('keeps Signup unconfigured and shows cart recovery only for Checkout', () => {
    render(<CareHomepage />)
    let dialog = openCategory('Conversion')
    expect(within(dialog).getByText('Safe Signup')).toBeVisible()
    expect(within(dialog).getByText('Not configured')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: S.detailAction }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('img', { name: C.flag.cropAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-broken.png')
    fireEvent.click(within(dialog).getByRole('button', { name: S.recoveryAction }))
    expect(within(dialog).getByRole('img', { name: S.proofAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-verified.png')
    expect(within(dialog).getByText(S.proofBody)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: S.backAction }))
    expect(within(dialog).getByText('Safe Signup')).toBeVisible()
  })

  it('shows the coverage and protected-flow boundary without claiming unsupported execution', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: S.coverageAction }))
    const dialog = screen.getByRole('dialog')
    for (const card of S.categories) expect(within(dialog).getByRole('button', { name: new RegExp(card.name) })).toBeVisible()
    expect(within(dialog).getByText(C.coverage.boundary)).toBeVisible()
    expect(watchableOutcomeKinds()).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
    expect(C.monitoring.rows[2].status).toBe('Not configured')
  })

  it('shows dated sample scheduling and never suggests a UI control runs verification', () => {
    render(<CareHomepage />)
    const monitoring = document.getElementById('monitoring')!
    expect(within(monitoring).getByText(C.monitoring.sample)).toBeVisible()
    expect(within(monitoring).getByText(C.monitoring.note)).toBeVisible()
    expect(within(monitoring).getByText('Not scheduled')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Verify fix/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Just now')).not.toBeInTheDocument()
  })

  it('copies scoped guidance without resolving the Flag and restores the category opener', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CareHomepage />)
    const opener = screen.getByRole('button', { name: 'Open Pages' }); opener.focus()
    let dialog = openCategory('Pages')
    fireEvent.click(within(dialog).getByRole('button', { name: S.detailAction }))
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: S.sampleCopy }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(S.availabilityPrompt))
    expect(within(dialog).getByText(S.unresolved)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('provides readable guidance if clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    render(<CareHomepage />)
    const dialog = openCategory('Pages')
    fireEvent.click(within(dialog).getByRole('button', { name: S.detailAction }))
    fireEvent.click(within(dialog).getByRole('button', { name: S.sampleCopy }))
    await waitFor(() => expect(within(dialog).getByRole('textbox', { name: S.guidanceLabel })).toHaveValue(S.availabilityPrompt))
  })

  it('compares distinct local failure and recovery captures with keyboard controls', () => {
    render(<CareHomepage />)
    const slider = screen.getByRole('slider', { name: C.workflow.compareLabel })
    fireEvent.keyDown(slider, { key: 'End' })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })
})
