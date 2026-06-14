import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  SCREENSHOT_FRAME,
  MOBILE_FRAME_WIDTH_CLASS,
  viewportAspectStyle,
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

  it('viewportAspectStyle matches capture ratios', () => {
    assert.deepEqual(viewportAspectStyle('desktop'), { aspectRatio: '1280 / 900' })
    assert.deepEqual(viewportAspectStyle('mobile'), { aspectRatio: '375 / 812' })
  })
})
