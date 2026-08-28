import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceDeviceToggle } from '@/components/report/WorkspaceDeviceToggle'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import { WorkspacePreviewTransport } from '@/components/report/WorkspacePreviewTransport'
import { ScanWorkingMark, ScanWorkingStatus } from '@/components/report/ScanWorkingStatus'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import { REPORT_COPY } from '@/lib/marketing/copy'

const steps: PlaybackStep[] = [
  { id: 's1', eventIndex: 0, label: 'Load homepage' },
  { id: 's2', eventIndex: 1, label: 'Click start' },
]

describe('workspace chrome primitives', () => {
  it('keeps one shared mobile tab bar and reports the selected surface', () => {
    const onSelect = vi.fn()
    render(
      <WorkspaceMobileTabs
        label={REPORT_COPY.workspace.panels.mobileTabsLabel}
        tabs={[
          {
            id: 'chat',
            controls: 'agent-panel',
            label: 'Agent',
            selected: false,
            onSelect,
            icon: <span data-testid="agent-icon" aria-hidden />,
          },
          { id: 'browser', controls: 'product-panel', href: '?view=timeline', label: 'Preview', selected: true, onSelect },
          {
            id: 'report',
            controls: 'product-panel',
            href: '?view=report',
            label: 'Report',
            selected: false,
            onSelect,
            icon: <span data-testid="report-icon" aria-hidden />,
          },
        ]}
      />
    )

    const tabs = screen.getByRole('tablist', { name: 'Review panels' })
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('agent-icon')).toBeInTheDocument()
    expect(screen.getByTestId('report-icon')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Agent' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(tabs).toBeInTheDocument()
  })

  it('puts Desktop and Mobile in the Product header, not the transport', () => {
    const onDeviceChange = vi.fn()
    render(<WorkspaceDeviceToggle device="desktop" onDeviceChange={onDeviceChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Mobile' }))
    expect(onDeviceChange).toHaveBeenCalledWith('mobile')
  })

  it('docks a gated transport without leaking step payload', () => {
    render(
      <WorkspacePreviewTransport
        steps={steps}
        canReplay={false}
        gateActionHref="/sign-in?next=%2Freport%2Fa1"
      />
    )

    expect(screen.getByLabelText('Preview controls')).toHaveClass('h-12')
    expect(screen.getByRole('link', { name: 'Sign in to view Timeline' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Freport%2Fa1'
    )
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Load homepage/ })).not.toBeInTheDocument()
  })

  it('scrubs entitled path steps and can return to live', () => {
    const onSelectStep = vi.fn()
    const onScrub = vi.fn()
    const onBackToLive = vi.fn()
    render(
      <WorkspacePreviewTransport
        steps={steps}
        activeIndex={0}
        canReplay
        onSelectStep={onSelectStep}
        onScrub={onScrub}
        onBackToLive={onBackToLive}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Step 2 · Click start' }))
    expect(onSelectStep).toHaveBeenCalledWith(1)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onScrub).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: REPORT_COPY.workspace.playback.backToLive }))
    expect(onBackToLive).toHaveBeenCalled()
  })

  it('keeps the working mark and a fixed-width progress readout', () => {
    render(
      <>
        <ScanWorkingMark />
        <ScanWorkingStatus
          stageDetail="Opening desktop and mobile"
          progress={46}
          current={2}
          total={5}
        />
      </>
    )

    expect(screen.getByRole('status')).toHaveTextContent('Working')
    expect(screen.getByText('46%')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
    expect(screen.getByText('Opening desktop and mobile')).toBeInTheDocument()
  })
})
