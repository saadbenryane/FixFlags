import { describe, expect, it } from 'vitest'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  equalHeightMobileWidthForDesktopWidth,
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
})
