import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'

const searchParamValues = new Map<string, string>()
const searchParamsMock = {
  get: vi.fn<(name: string) => string | null>((name) => searchParamValues.get(name) ?? null),
  toString: vi.fn(() => new URLSearchParams([...searchParamValues.entries()]).toString()),
}

function capabilities(
  overrides: Partial<ReportWorkspaceCapabilities> = {},
): ReportWorkspaceCapabilities {
  return {
    promptAccess: 'none',
    canCopyPrompts: false,
    canReplayTimeline: true,
    canChat: false,
    canUseCanvas: false,
    canShare: false,
    canRecheck: false,
    canGiveFeedback: false,
    demonstratedFlagId: null,
    ...overrides,
  }
}

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

function renderShell(replayStep?: string, view?: 'timeline' | 'report' | 'canvas', scanning = true) {
  searchParamValues.clear()
  if (replayStep) searchParamValues.set('step', replayStep)
  if (view) searchParamValues.set('view', view)
  return render(
    <ReportWorkspaceSplitShell
      isActiveReview
      scanning={scanning}
      leftPanel={<div data-testid="chat">Chat</div>}
      browserUrl="https://example.com"
      reportHeader={<div>Score 72</div>}
      reportPanel={<div data-testid="report-panel">Fix list</div>}
      steps={steps}
      capabilities={capabilities()}
    />
  )
}

function openTimeline() {
  const preview = screen.queryAllByRole('tab', { name: 'Preview' })[0]
  const timeline = screen.queryAllByRole('tab', { name: 'Timeline' })[0]
  fireEvent.click((preview ?? timeline)!)
}

beforeEach(() => {
  window.history.replaceState({}, '', '/report/a1')
  searchParamValues.clear()
  searchParamsMock.get.mockClear()
})

describe('ReportWorkspaceSplitShell playback', () => {
  it('hides the preview pane on a completed report', () => {
    render(
      <ReportWorkspaceSplitShell
        leftPanel={<div>Agent</div>}
        browserUrl="https://example.com"
        reportPanel={<div>Report</div>}
        steps={steps}
        capabilities={capabilities({ canReplayTimeline: false })}
        timelineGateActionHref="/sign-in?next=%2Freport%2Fa1"
      />,
    )

    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('tab', { name: 'Preview' })).toHaveLength(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('keeps the completed report on Report without a preview pane', () => {
    renderShell(undefined, undefined, false)
    expect(screen.getByTestId('report-panel')).toBeInTheDocument()
    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('tab', { name: 'Preview' })).toHaveLength(0)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
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
        capabilities={capabilities()}
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

  it('gives scanning viewers the device control in the Product header and the Timeline gate but no step payload', () => {
    const { container } = render(
      <ReportWorkspaceSplitShell
        leftPanel={<div>Agent</div>}
        browserUrl="https://example.com"
        reportPanel={<div>Report</div>}
        steps={steps}
        scanning
        capabilities={capabilities({ canReplayTimeline: false })}
        timelineGateActionHref="/sign-in?next=%2Freport%2Fa1"
      />,
    )

    fireEvent.click(screen.getAllByRole('tab', { name: 'Preview' })[0]!)

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
    expect(tabs.indexOf('Preview')).toBeLessThan(tabs.indexOf('Report'))
  })

  it('puts Score in the fixed Report header and restores URL-backed sibling views', async () => {
    const { container } = renderShell(undefined, 'report', false)

    await waitFor(() => {
      expect(container.querySelector('[data-workspace-ready="true"]')).toBeInTheDocument()
    })
    expect(screen.getByText('Score 72')).toBeInTheDocument()
    expect(screen.getByLabelText('Product example.com')).toBeInTheDocument()
    expect(screen.queryByText('Product')).not.toBeInTheDocument()

    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)

    window.history.pushState({}, '', '/report/a1?view=report')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.getByText('Score 72')).toBeInTheDocument())
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
        capabilities={capabilities()}
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

  it('exposes native sibling-view destinations and WAI tab relationships', () => {
    renderShell()

    const reportTab = screen.getAllByRole('tab', { name: 'Report' })[0]!
    const previewTab = screen.getAllByRole('tab', { name: 'Preview' })[0]!
    expect(reportTab).toHaveAttribute('href', '/report/a1?view=report')
    expect(previewTab).toHaveAttribute('href', '/report/a1?view=timeline')
    expect(reportTab).toHaveAttribute('aria-controls')
    expect(document.getElementById(reportTab.getAttribute('aria-controls')!)).toHaveAttribute(
      'role',
      'tabpanel',
    )
  })

  it('moves and activates URL-backed tabs with Arrow, Home, and End keys', () => {
    renderShell()

    const reportTab = screen.getAllByRole('tab', { name: 'Report' })[0]!
    reportTab.focus()
    fireEvent.keyDown(reportTab, { key: 'ArrowLeft' })
    expect(screen.getAllByRole('tab', { name: 'Preview' })[0]).toHaveFocus()
    expect(window.location.search).toContain('view=timeline')

    fireEvent.keyDown(screen.getAllByRole('tab', { name: 'Preview' })[0]!, { key: 'End' })
    expect(screen.getAllByRole('tab', { name: 'Report' })[0]).toHaveFocus()
    expect(window.location.search).toContain('view=report')
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
