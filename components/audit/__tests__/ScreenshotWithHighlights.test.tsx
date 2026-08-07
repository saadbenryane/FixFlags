import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'

// jsdom never loads real images, so a URL that the harness can stub via the
// global Image error path drives the fallback states deterministically.
const HOST = 'example.com'
const HIGHLIGHTS: EvidenceHighlight[] = []
const URL_DESKTOP = '/api/screenshots/audit-1/desktop'

function renderPanel() {
  return render(
    <ScreenshotWithHighlights
      host={HOST}
      desktopScreenshot={URL_DESKTOP}
      mobileScreenshot={null}
      highlights={HIGHLIGHTS}
    />
  )
}

describe('ScreenshotWithHighlights fallback chain', () => {
  it('renders a loading placeholder before the image resolves', () => {
    renderPanel()
    // The placeholder is aria-hidden but present while the img is hidden.
    expect(screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('shows an error state with a retry control when the image fails', async () => {
    renderPanel()
    const img = screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })
    // Simulate a failed network load in jsdom.
    Object.defineProperty(img, 'complete', { value: false })
    img.dispatchEvent(new Event('error'))

    await waitFor(() => {
      expect(
        screen.getByRole('img', {
          name: /could not be loaded/,
        })
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Screenshot unavailable')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeInTheDocument()

    // Retry re-mounts the <img> (cache-busted URL) instead of staying stuck.
    retry.click()
    const retried = await waitFor(() =>
      screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })
    )
    expect(retried.getAttribute('src')).toContain('retry=1')
  })

  it('hides the loading placeholder once the image loads', async () => {
    renderPanel()
    const img = screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })
    img.dispatchEvent(new Event('load'))

    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeNull()
    })
  })
})
