import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportPane } from '@/components/report/ReportPane'

describe('ReportPane', () => {
  it('keeps status and the explorer inside the report frame', () => {
    const { container } = render(
      <ReportPane
        beforeExplorer={<p>Status</p>}
        explorer={<section aria-label="Fix list">Flags</section>}
      />
    )

    const frame = container.querySelector('[data-report-frame]')
    expect(frame).not.toBeNull()
    expect(frame).toContainElement(screen.getByText('Status'))
    expect(frame).toContainElement(screen.getByRole('region', { name: 'Fix list' }))
    expect(screen.queryByText('Review context')).not.toBeInTheDocument()
  })
})
