import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportPane } from '@/components/report/ReportPane'

describe('ReportPane', () => {
  it('keeps status, the explorer, and secondary context in one canonical composition', () => {
    const { container } = render(
      <ReportPane
        beforeExplorer={<p>Status</p>}
        explorer={<section aria-label="Fix list">Flags</section>}
        afterFrame={<details><summary>Review context</summary></details>}
      />
    )

    const frame = container.querySelector('[data-report-frame]')
    expect(frame).not.toBeNull()
    expect(frame).toContainElement(screen.getByText('Status'))
    expect(frame).toContainElement(screen.getByRole('region', { name: 'Fix list' }))
    expect(frame).not.toContainElement(screen.getByText('Review context'))
  })
})
