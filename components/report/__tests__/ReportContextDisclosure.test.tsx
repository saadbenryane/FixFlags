import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReportContextDisclosure } from '@/components/report/ReportContextDisclosure'
import { REPORT_COPY } from '@/lib/marketing/copy'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('ReportContextDisclosure', () => {
  it('stays collapsed so review context never pushes the fix list down the pane', () => {
    render(
      <ReportContextDisclosure sectionIds={['report-contract']}>
        <div id="report-contract">Product contract</div>
      </ReportContextDisclosure>
    )

    expect(screen.getByText(REPORT_COPY.reviewContext.title)).toBeInTheDocument()
    expect(screen.getByRole('group')).not.toHaveAttribute('open')
  })

  it('opens itself when a report anchor points at a section it carries', async () => {
    window.history.replaceState({}, '', '/report/a1#report-contract')
    render(
      <ReportContextDisclosure sectionIds={['report-contract']}>
        <div id="report-contract">Product contract</div>
      </ReportContextDisclosure>
    )

    await waitFor(() => {
      expect(screen.getByRole('group')).toHaveAttribute('open')
    })
  })

  it('ignores anchors for sections it does not carry', () => {
    window.history.replaceState({}, '', '/report/a1#report-flags')
    render(
      <ReportContextDisclosure sectionIds={['report-contract']}>
        <div id="report-contract">Product contract</div>
      </ReportContextDisclosure>
    )

    expect(screen.getByRole('group')).not.toHaveAttribute('open')
  })
})
