import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'

const searchParamsMock = { get: vi.fn<(name: string) => string | null>(() => null) }

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock,
  usePathname: () => '/report/a1',
}))

const events: ActionTimelineEvent[] = [
  { t: 0, kind: 'navigate', label: 'Load homepage', url: 'https://example.com', screenshot: 'ss-home' },
  { t: 1200, kind: 'click', label: 'Click pricing', url: 'https://example.com/pricing', screenshot: 'ss-pricing' },
  { t: 2400, kind: 'form', label: 'Submit form', url: 'https://example.com/signup' },
]

const steps = buildPlaybackSteps(events)

function renderShell(replayStep?: string) {
  searchParamsMock.get.mockReturnValue(replayStep ?? null)
  return render(
    <ReportWorkspaceSplitShell
      isActiveReview
      leftPanel={<div data-testid="chat">Chat</div>}
      browserUrl="https://example.com"
      reportPanel={<div data-testid="report-panel">Fix list</div>}
      steps={steps}
    />
  )
}

function stepButtons(label: string) {
  return screen.getAllByRole('button', { name: label })
}

function browserStepLabels() {
  return screen.getAllByText(/Step \d · .+/, { selector: 'p' })
}

beforeEach(() => {
  searchParamsMock.get.mockClear()
})

describe('ReportWorkspaceSplitShell playback', () => {
  it('keeps Timeline discoverable but locked without rendering playback for logged-out visitors', () => {
    render(
      <ReportWorkspaceSplitShell
        leftPanel={<div>Agent</div>}
        browserUrl="https://example.com"
        reportPanel={<div>Report</div>}
        steps={steps}
        canUseTimeline={false}
      />,
    )

    fireEvent.click(screen.getAllByRole('tab', { name: 'Timeline' })[0]!)
    expect(screen.getAllByText('See how FixFlags checked the path').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Sign in to view Timeline' })[0]).toHaveAttribute(
      'href',
      '/sign-in?next=%2Freport%2Fa1',
    )
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('renders a scrub timeline with one step marker per captured step', () => {
    renderShell()
    const scrubs = screen.getAllByRole('slider')
    expect(scrubs.length).toBeGreaterThan(0)
    const scrub = scrubs[0]!
    expect(scrub).toHaveAttribute('type', 'range')
    expect(scrub).toHaveAttribute('min', '0')
    expect(scrub).toHaveAttribute('max', String(steps.length - 1))
    expect(stepButtons('Step 1 · Load homepage').length).toBeGreaterThan(0)
    expect(stepButtons('Step 2 · Click pricing').length).toBeGreaterThan(0)
  })

  it('selecting a step updates the browser panel and highlights the activity row', () => {
    renderShell()

    fireEvent.click(stepButtons('Step 2 · Click pricing')[0]!)

    expect(stepButtons('Step 2 · Click pricing')[0]).toHaveAttribute('aria-pressed', 'true')
    expect(browserStepLabels().some((el) => el.textContent?.startsWith('Step 2'))).toBe(true)
    expect(screen.getAllByText('Back to live').length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /Click pricing/i })[0]
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking an activity row seeks playback to the matching step', () => {
    renderShell()

    fireEvent.click(screen.getAllByRole('button', { name: /Submit form/i })[0]!)

    expect(stepButtons('Step 3 · Submit form')[0]).toHaveAttribute('aria-pressed', 'true')
    expect(browserStepLabels().some((el) => el.textContent?.startsWith('Step 3'))).toBe(true)
  })

  it('scrubbing the range selects the matching step', () => {
    renderShell()

    const scrub = screen.getAllByRole('slider')[0]!
    fireEvent.change(scrub, { target: { value: '2' } })

    expect(stepButtons('Step 3 · Submit form')[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('honors a ?step= replay param by selecting that step and showing the browser', () => {
    renderShell('2')

    expect(stepButtons('Step 2 · Click pricing')[0]).toHaveAttribute('aria-pressed', 'true')
    expect(browserStepLabels().some((el) => el.textContent?.startsWith('Step 2'))).toBe(true)
  })
})
