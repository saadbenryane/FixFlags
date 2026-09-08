import { describe, expect, it } from 'vitest'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  equalHeightMobileWidthForDesktopWidth,
  huggedScreenshotFrameStyle,
  SCREENSHOT_FRAME_MAX_HEIGHT,
} from '@/lib/audit/viewports'

describe('evidence preview geometry', () => {
  it('gives desktop and mobile previews the same rendered height', () => {
    const desktopWidth = 640
    const mobileWidth = equalHeightMobileWidthForDesktopWidth(desktopWidth)
    const desktopHeight =
      desktopWidth * (DESKTOP_VIEWPORT.height / DESKTOP_VIEWPORT.width)
    const mobileHeight =
      mobileWidth * (MOBILE_VIEWPORT.height / MOBILE_VIEWPORT.width)

    expect(mobileHeight).toBeCloseTo(desktopHeight, 8)
  })

  it('caps the evidence frame to the capture aspect instead of a stretched box', () => {
    const desktop = huggedScreenshotFrameStyle('desktop')
    const mobile = huggedScreenshotFrameStyle('mobile')
    expect(desktop.aspectRatio).toBe(`${DESKTOP_VIEWPORT.width} / ${DESKTOP_VIEWPORT.height}`)
    expect(mobile.aspectRatio).toBe(`${MOBILE_VIEWPORT.width} / ${MOBILE_VIEWPORT.height}`)
    expect(desktop.maxHeight).toBe(SCREENSHOT_FRAME_MAX_HEIGHT)
    expect(String(desktop.width)).toContain(SCREENSHOT_FRAME_MAX_HEIGHT)
    expect(String(desktop.width)).toContain('min(100%')
  })
})
