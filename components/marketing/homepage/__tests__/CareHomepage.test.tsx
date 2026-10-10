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
    expect(screen.getByText(C.hero.eyebrow)).toBeVisible()
    expect(screen.getByText(C.hero.body)).toBeVisible()
    for (const benefit of C.hero.benefits) expect(screen.getByText(benefit.title)).toBeVisible()
    expect(screen.queryByRole('link', { name: S.exploreAction })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const board = screen.getByRole('region', { name: C.boardAria })
    for (const card of S.categories) expect(within(board).getByRole('button', { name: `Open ${card.name}` })).toBeVisible()
    expect(within(board).getAllByText('0 Flags')).toHaveLength(4)
    expect(within(board).getByText('Partial')).toBeVisible()
    const summary = within(board).getByRole('group', { name: S.summaryLabel })
    expect(within(summary).getByText('2')).toBeVisible()
    expect(within(summary).getByText('Flags')).toBeVisible()
    expect(within(summary).getByText('With 0 Flags')).toBeVisible()
    expect(within(summary).getByText('Still to check')).toBeVisible()
    expect(within(board).getByText('15 minutes ago')).toBeVisible()
    expect(within(board).getByRole('link', { name: S.boardAction })).toHaveAttribute('href', '#analyze')
    expect(within(board).queryByText(/need attention/i)).not.toBeInTheDocument()
    expect(within(board).queryByRole('button', { name: /Coverage and check times/i })).not.toBeInTheDocument()
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

  it('shows a capable illustrative website without hiding the incomplete measurement', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    const categories = within(board).getAllByRole('button').filter(button => button.getAttribute('aria-label')?.startsWith('Open '))
    expect(categories).toHaveLength(7)
    expect(categories.slice(0, 2).map(button => button.getAttribute('aria-label'))).toEqual(['Open Pages', 'Open Conversion'])
    expect(within(board).getAllByText('0 Flags')).toHaveLength(4)
    expect(within(board).getByText('Partial')).toBeVisible()
    expect(within(board).getByText('No mobile speed result')).toBeVisible()
    expect(screen.getByText(S.note)).toBeVisible()
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

  it('keeps Signup unconfigured and shows scoped checkout recovery only for Checkout', () => {
    render(<CareHomepage />)
    let dialog = openCategory('Conversion')
    expect(within(dialog).getByText('Safe Signup')).toBeVisible()
    expect(within(dialog).getByText('Not configured')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: S.detailAction }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('region', { name: C.story.example.failedLabel })).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: S.recoveryAction }))
    expect(within(dialog).getByRole('region', { name: C.story.example.recoveredLabel })).toBeVisible()
    expect(within(dialog).getByText(S.proofBody)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: S.backAction }))
    expect(within(dialog).getByText('Safe Signup')).toBeVisible()
  })

  it('keeps scope and freshness in progressive category depth', () => {
    render(<CareHomepage />)
    const dialog = openCategory('Pages')
    const disclosure = within(dialog).getByText(S.evidenceAction)
    expect(disclosure).toBeVisible()
    fireEvent.click(disclosure)
    expect(within(dialog).getByText(S.categories[0].scope)).toBeVisible()
    expect(within(dialog).getByText(S.sources.http)).toBeVisible()
    expect(watchableOutcomeKinds()).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
    expect(C.monitoring.notScheduled).toBe('Not scheduled')
  })

  it('shows dated sample scheduling and never suggests a UI control runs verification', () => {
    render(<CareHomepage />)
    const board = screen.getByRole('region', { name: C.boardAria })
    expect(within(board).getByText(C.monitoring.summary)).toBeVisible()
    expect(screen.queryByText(C.monitoring.nextValue)).not.toBeInTheDocument()
    fireEvent.click(within(board).getByRole('button', { name: C.monitoring.action }))
    const monitoring = screen.getByRole('dialog')
    expect(within(monitoring).getByText(C.monitoring.sample)).toBeVisible()
    expect(within(monitoring).getByText(C.monitoring.note)).toBeVisible()
    expect(within(monitoring).getByText(C.monitoring.setup)).toBeVisible()
    expect(within(monitoring).getByText('Not scheduled')).toBeVisible()
    expect(within(monitoring).getByText(C.monitoring.nextValue)).toBeVisible()
    expect(within(monitoring).getAllByText('1 Flag')).toHaveLength(2)
    expect(within(monitoring).queryByText('Verified recovery')).not.toBeInTheDocument()
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

  it('connects the scoped failure, fresh recovery and continuing monitoring', () => {
    render(<CareHomepage />)
    fireEvent.click(screen.getByRole('button', { name: C.story.after }))
    expect(screen.getByRole('heading', { name: C.story.afterTitle })).toBeVisible()
    expect(screen.getByRole('region', { name: C.story.example.recoveredLabel })).toBeVisible()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByText(C.story.example.scope)).toBeVisible()
    expect(screen.getByText(C.story.aboutBody)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.story.before }))
    expect(screen.getByRole('region', { name: C.story.example.failedLabel })).toBeVisible()
  })
  it('retains the orbital integration section with the existing four routes', () => {
    render(<CareHomepage />)
    expect(screen.getByRole('heading', { name: C.integrations.title })).toBeVisible()
    expect(screen.getByRole('link', { name: /Shopify.*Store context/ })).toHaveAttribute('href', '/install')
    expect(screen.getByRole('link', { name: /Analytics.*Audience context/ })).toHaveAttribute('href', '/integrations#analytics')
    expect(screen.getByRole('link', { name: /Search Console.*Search context/ })).toHaveAttribute('href', '/integrations#search-console')
    expect(screen.getByRole('link', { name: /GitHub.*Flag handoff/ })).toHaveAttribute('href', '/sign-in')
  })

})
