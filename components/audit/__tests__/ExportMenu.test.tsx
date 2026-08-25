// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportMenu } from '../ExportMenu'
import { SITE_URL } from '@/lib/marketing/copy'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('ExportMenu', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copies the canonical public report link', async () => {
    render(
      <ExportMenu
        auditId="review-1"
        url="https://example.com"
        score={72}
        rubrics={[]}
        flags={[]}
      />,
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: /export/i }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(await screen.findByText('Report link'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${SITE_URL}/report/review-1`,
      )
    })
  })
})
