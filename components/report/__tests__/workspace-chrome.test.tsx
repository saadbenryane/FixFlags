import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import { ScanWorkingMark, ScanWorkingStatus } from '@/components/report/ScanWorkingStatus'
import { REPORT_COPY } from '@/lib/marketing/copy-barrel'

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
