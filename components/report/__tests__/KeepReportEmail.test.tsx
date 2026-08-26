// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KeepReportEmail } from '@/components/report/KeepReportEmail'
import { REPORT_COPY } from '@/lib/marketing/copy'

describe('KeepReportEmail', () => {
  it('sends the report link and shows confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <KeepReportEmail auditId="review-1" open onOpenChange={vi.fn()} />,
    )

    fireEvent.change(screen.getByPlaceholderText(REPORT_COPY.keepReport.emailPlaceholder), {
      target: { value: 'you@company.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: REPORT_COPY.keepReport.action }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reports/review-1/keep',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText(REPORT_COPY.keepReport.saved)).toBeInTheDocument()
  })
})
