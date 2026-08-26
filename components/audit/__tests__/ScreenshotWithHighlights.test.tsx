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
  it('draws comparison state inside the capture so scrollports cannot clip it', () => {
    render(
      <ScreenshotWithHighlights
        host={HOST}
        desktopScreenshot={URL_DESKTOP}
        mobileScreenshot={null}
        highlights={HIGHLIGHTS}
        affectedDevices={['desktop']}
      />
    )

    expect(document.querySelector('.ring-inset.ring-destructive')).not.toBeNull()
    expect(document.querySelector('.ring-offset-2')).toBeNull()
  })

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

  it('shows both captures with a not-flagged badge on the unaffected device', () => {
    render(
      <ScreenshotWithHighlights
        host={HOST}
        desktopScreenshot="/desktop.png"
        mobileScreenshot="/mobile.png"
        highlights={HIGHLIGHTS}
        affectedDevices={['mobile']}
      />
    )

    expect(screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `mobile screenshot of ${HOST}` })).toBeInTheDocument()
    expect(screen.getByText('Not flagged on desktop')).toBeInTheDocument()
    expect(screen.getByText('Flagged on mobile')).toBeInTheDocument()
  })

  it('plays motion evidence in the affected frame instead of a third image', () => {
    render(
      <ScreenshotWithHighlights
        host={HOST}
        desktopScreenshot="/desktop.png"
        mobileScreenshot="/mobile.png"
        highlights={HIGHLIGHTS}
        affectedDevices={['mobile']}
        flagVisual={{ url: '/loading.gif', device: 'mobile', type: 'animated-gif' }}
      />
    )

    expect(screen.getByRole('img', { name: `mobile screenshot of ${HOST}` })).toHaveAttribute(
      'src',
      '/loading.gif'
    )
    expect(screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })).toHaveAttribute(
      'src',
      '/desktop.png'
    )
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('omits a missing capture instead of using a not-flagged badge as filler', () => {
    render(
      <ScreenshotWithHighlights
        host={HOST}
        desktopScreenshot="/desktop.png"
        mobileScreenshot={null}
        highlights={HIGHLIGHTS}
        affectedDevices={['desktop']}
      />
    )

    expect(screen.getByRole('img', { name: `desktop screenshot of ${HOST}` })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: `mobile screenshot of ${HOST}` })).not.toBeInTheDocument()
    expect(screen.queryByText('Not flagged on mobile')).not.toBeInTheDocument()
  })
})
