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

function openTimeline() {
  fireEvent.click(screen.getAllByRole('tab', { name: 'Timeline' })[0]!)
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
    openTimeline()
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
    openTimeline()

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
    openTimeline()

    fireEvent.click(screen.getAllByRole('button', { name: /Submit form/i })[0]!)

    expect(stepButtons('Step 3 · Submit form')[0]).toHaveAttribute('aria-pressed', 'true')
    expect(browserStepLabels().some((el) => el.textContent?.startsWith('Step 3'))).toBe(true)
  })

  it('scrubbing the range selects the matching step', () => {
    renderShell()
    openTimeline()

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

describe('ReportWorkspaceSplitShell product stage', () => {
  function transport(container: HTMLElement) {
    return container.querySelector('[aria-label="Preview controls"]')
  }

  function stage(container: HTMLElement) {
    return transport(container)?.previousElementSibling ?? null
  }

  it('renders the captured page with no browser chrome and names the URL once per pane', () => {
    sessionStorage.clear()
    const { container } = renderShell()
    openTimeline()

    // No traffic lights and no URL pill inside the editor.
    expect(container.querySelectorAll('.rounded-full.bg-muted-foreground\\/25')).toHaveLength(0)

    const panes = Array.from(container.querySelectorAll('[aria-label="Preview controls"]')).map(
      (bar) => bar.parentElement!
    )
    expect(panes.length).toBeGreaterThan(0)
    panes.forEach((pane) => {
      const addresses = Array.from(pane.querySelectorAll('p')).filter(
        (node) => node.textContent === 'example.com'
      )
      expect(addresses).toHaveLength(1)
    })
  })

  it('names the reviewed page including its path, so a sub-page is not read as the domain', () => {
    render(
      <ReportWorkspaceSplitShell
        leftPanel={<div>Agent</div>}
        browserUrl="https://fixflags.com/demo"
        reportPanel={<div>Report</div>}
        steps={steps}
      />,
    )

    expect(screen.getAllByText('fixflags.com/demo').length).toBeGreaterThan(0)
    expect(screen.queryByText('fixflags.com')).not.toBeInTheDocument()
  })

  it('docks the transport directly under the stage as the last row of the pane', () => {
    const { container } = renderShell()
    openTimeline()

    const bar = transport(container)
    expect(bar).not.toBeNull()
    expect(bar!.nextElementSibling).toBeNull()
    expect(stage(container)).not.toBeNull()
  })

  it('keeps the stage container unchanged when the viewer switches device', () => {
    const { container } = renderShell()
    openTimeline()

    const before = stage(container)!.className
    fireEvent.click(screen.getAllByRole('tab', { name: 'Mobile' })[0]!)

    expect(stage(container)!.className).toBe(before)
  })

  it('gives anonymous viewers the device control in the Product header and the Timeline gate but no step payload', () => {
    const { container } = render(
      <ReportWorkspaceSplitShell
        leftPanel={<div>Agent</div>}
        browserUrl="https://example.com"
        reportPanel={<div>Report</div>}
        steps={steps}
        canUseTimeline={false}
      />,
    )

    fireEvent.click(screen.getAllByRole('tab', { name: 'Timeline' })[0]!)

    expect(transport(container)).not.toBeNull()
    expect(screen.getAllByRole('tab', { name: 'Mobile' }).length).toBeGreaterThan(0)
    // Device lives next to Preview in the header, not inside the transport.
    expect(transport(container)!.querySelector('[aria-label="Viewport"]')).toBeNull()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 1 · Load homepage/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in to view Timeline' }).length).toBeGreaterThan(0)
  })

  it('orders Preview before Report in the Product chrome', () => {
    renderShell()
    const toggle = screen.getAllByLabelText('Workspace view')[0]!
    const tabs = Array.from(toggle.querySelectorAll('[role="tab"]')).map(
      (tab) => tab.getAttribute('aria-label')
    )
    expect(tabs.indexOf('Timeline')).toBeLessThan(tabs.indexOf('Report'))
  })
})

describe('ReportWorkspaceSplitShell scanning', () => {
  function renderScanning() {
    return render(
      <ReportWorkspaceSplitShell
        isActiveReview
        scanning
        leftPanel={<div data-testid="chat">Agent</div>}
        browserUrl="https://example.com"
        reportPanel={<div data-testid="report-panel">Fix list</div>}
        steps={steps}
      />
    )
  }

  it('hides Timeline and Canvas, showing Report and Preview while a review runs', () => {
    renderScanning()

    expect(screen.queryAllByRole('tab', { name: 'Timeline' })).toHaveLength(0)
    expect(screen.queryAllByRole('tab', { name: 'Canvas' })).toHaveLength(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Preview' }).length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('tab', { name: 'Preview' }).some(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      ),
    ).toBe(true)
  })

  it('defaults to the Agent surface while scanning and switches to Preview', () => {
    sessionStorage.clear()
    renderScanning()

    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('chat').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('tab', { name: 'Preview' })[0]!)
    expect(screen.queryByTestId('report-panel')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
  })

  it('docks the transport while a review runs, on desktop and on the mobile Preview tab', () => {
    sessionStorage.clear()
    const { container } = renderScanning()

    // Desktop pane plus the mobile Preview tab both keep a docked transport.
    fireEvent.click(screen.getAllByRole('tab', { name: 'Preview' })[0]!)
    const bars = container.querySelectorAll('[aria-label="Preview controls"]')
    expect(bars.length).toBeGreaterThan(0)
    bars.forEach((bar) => expect(bar.nextElementSibling).toBeNull())
    expect(screen.getAllByText('Capturing the page').length).toBeGreaterThan(0)
  })

  it('gives every Product pane the same three rows: identity, stage, transport', () => {
    sessionStorage.clear()
    const { container } = renderScanning()

    fireEvent.click(screen.getAllByRole('tab', { name: 'Preview' })[0]!)

    const panes = Array.from(container.querySelectorAll('[aria-label="Preview controls"]')).map(
      (bar) => bar.parentElement!
    )
    expect(panes.length).toBeGreaterThan(0)
    panes.forEach((pane) => {
      expect(pane.children).toHaveLength(3)
      expect(pane.textContent).toContain('example.com')
    })
  })
})
