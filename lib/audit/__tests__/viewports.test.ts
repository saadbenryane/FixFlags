import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  DESKTOP_FRAME_FLEX_CLASS,
  SCREENSHOT_FRAME,
  MOBILE_FRAME_WIDTH_CLASS,
  SCREENSHOT_FRAMES_ROW_CLASS,
  SCREENSHOT_FRAMES_GRID_CLASS,
  viewportAspectStyle,
  mobileDisplayWidthForViewportHeight,
  mobileViewportSizeForHeight,
} from '@/lib/audit/viewports'

describe('viewports', () => {
  it('defines Puppeteer capture dimensions', () => {
    assert.deepEqual(DESKTOP_VIEWPORT, { width: 1280, height: 900 })
    assert.deepEqual(MOBILE_VIEWPORT, {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
    })
  })

  it('mobile display frame is 240px wide', () => {
    assert.equal(SCREENSHOT_FRAME.mobile.displayWidth, 240)
    assert.match(MOBILE_FRAME_WIDTH_CLASS, /240/)
  })

  it('screenshot frame layout classes', () => {
    assert.match(DESKTOP_FRAME_FLEX_CLASS, /flex-1/)
    assert.match(SCREENSHOT_FRAMES_ROW_CLASS, /flex-row/)
    assert.match(SCREENSHOT_FRAMES_GRID_CLASS, /grid-cols/)
  })

  it('viewportAspectStyle matches capture ratios', () => {
    assert.deepEqual(viewportAspectStyle('desktop'), { aspectRatio: '1280 / 900' })
    assert.deepEqual(viewportAspectStyle('mobile'), { aspectRatio: '375 / 812' })
  })

  it('mobileDisplayWidthForViewportHeight scales proportionally', () => {
    const desktopViewportHeight = 225
    const expected = desktopViewportHeight * (MOBILE_VIEWPORT.width / MOBILE_VIEWPORT.height)
    assert.equal(mobileDisplayWidthForViewportHeight(desktopViewportHeight), expected)
    assert.deepEqual(mobileViewportSizeForHeight(desktopViewportHeight), {
      height: desktopViewportHeight,
      width: expected,
    })
  })
})
