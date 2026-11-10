import { act, cleanup, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { OutcomeSummaryCard } from '../OutcomeSummaryCard'
import { OutcomeStateLabel } from '../OutcomeStateLabel'
import { staleOutcomeRecovery } from '@/lib/sites/outcome-state'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

const props = { name: 'Checkout', expectation: 'Checkout opens.', answer: 'Checkout opened in the recorded check.',
  coverage: 'One recorded page', freshness: 'Verified Nov 3, 2026, 12:00 PM UTC', state: 'CLEAR' as const }

it.each([
  { layout: 'row' as const, state: 'CLEAR' as const },
  { layout: 'card' as const, state: 'CLEAR' as const },
  { layout: 'row' as const, state: 'FLAG' as const },
  { layout: 'card' as const, state: 'FLAG' as const },
])('expires recorded $state assurance in the $layout and full-detail label without new work', async ({ layout, state }) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const validUntil = '2026-11-03T12:01:00Z'
  const answer = state === 'CLEAR' ? props.answer : 'Checkout did not open in the recorded check.'
  const expected = state === 'CLEAR' ? 'Clear' : 'Flag'
  const page = render(<><OutcomeSummaryCard {...props} state={state} answer={answer} layout={layout} validUntil={validUntil} />
    <div data-testid="detail-state"><OutcomeStateLabel state={state} validUntil={validUntil} running={false} enabled /></div></>)
  try {
    expect(screen.getByRole('status')).toHaveTextContent(expected)
    expect(screen.getByTestId('detail-state')).toHaveTextContent(expected)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByRole('status')).toHaveTextContent('Stale')
    expect(screen.getByRole('status').className).not.toContain('text-success')
    expect(screen.getByTestId('detail-state')).toHaveTextContent('Stale')
    expect(screen.getByText(answer)).toBeVisible()
    expect(screen.getByText(staleOutcomeRecovery())).toBeVisible()
    page.rerender(<><OutcomeSummaryCard {...props} state={state} answer={answer} layout={layout} validUntil="2026-11-03T13:00:00Z" />
      <div data-testid="detail-state"><OutcomeStateLabel state={state} validUntil="2026-11-03T13:00:00Z" running={false} enabled /></div></>)
    expect(screen.getByRole('status')).toHaveTextContent(expected)
    expect(screen.getByTestId('detail-state')).toHaveTextContent(expected)
    expect(fetch).not.toHaveBeenCalled()
  } finally { cleanup(); visibility.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers() }
})

it.each([
  { layout: 'row' as const, compact: false },
  { layout: 'card' as const, compact: false },
  { layout: 'card' as const, compact: true },
])('keeps previous evidence without a success signal during verification ($layout, compact: $compact)', presentation => {
  const page = render(<OutcomeSummaryCard {...props} {...presentation} />)
  expect(screen.getByRole('status').className).toContain('text-success')
  page.rerender(<OutcomeSummaryCard {...props} {...presentation} running />)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent(C.outcome.verifying)
  expect(status.className).not.toContain('text-success')
  expect(status.querySelector('.lucide-loader-circle')).not.toBeNull()
  expect(status.querySelector('.lucide-check')).toBeNull()
  expect(screen.getByText(props.answer)).toBeVisible()
  expect(screen.getByText(`${C.previousResults}, ${props.freshness}`)).toBeVisible()
  page.rerender(<OutcomeSummaryCard {...props} {...presentation} state="FLAG" answer="Checkout did not open in the new check." />)
  expect(screen.getByRole('status').className).toContain('text-brand')
  expect(screen.queryByText(C.outcome.verifying)).not.toBeInTheDocument()
  expect(screen.getByText('Checkout did not open in the new check.')).toBeVisible()
  expect(screen.queryByText(props.answer)).not.toBeInTheDocument()
  expect(screen.queryByText(`${C.previousResults}, ${props.freshness}`)).not.toBeInTheDocument()
})
