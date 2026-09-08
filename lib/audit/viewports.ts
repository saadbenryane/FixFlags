import type { CSSProperties } from 'react'

/** Browser capture viewports, UI screenshot frames use matching aspect ratios. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 900 }
export const MOBILE_VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 2 }

export const SCREENSHOT_FRAME = {
  desktop: {
    label: 'Desktop',
    displayWidth: null as number | null,
  },
  mobile: {
    label: 'Mobile',
    displayWidth: 240,
  },
} as const

export const MOBILE_FRAME_WIDTH_CLASS = 'w-[240px] max-w-full shrink-0'

export function viewportAspectStyle(device: 'desktop' | 'mobile'): CSSProperties {
  const vp = device === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT
  return { aspectRatio: `${vp.width} / ${vp.height}` }
}

/** Max display height for a Flag evidence capture so the frame stays pane-sized. */
export const SCREENSHOT_FRAME_MAX_HEIGHT = '28rem'

/**
 * Size the evidence frame to the capture aspect, capped by parent width and
 * max height. A `w-full` + `max-h` box is wider than the screenshot, so the
 * border sits around empty letterbox and the image can cover an inset ring.
 */
export function huggedScreenshotFrameStyle(device: 'desktop' | 'mobile'): CSSProperties {
  const vp = device === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT
  const aspect = vp.width / vp.height
  return {
    aspectRatio: `${vp.width} / ${vp.height}`,
    width: `min(100%, calc(${SCREENSHOT_FRAME_MAX_HEIGHT} * ${aspect}))`,
    maxHeight: SCREENSHOT_FRAME_MAX_HEIGHT,
    height: 'auto',
  }
}

/** Mobile frame width when its viewport height matches a desktop viewport height. */
export function mobileDisplayWidthForViewportHeight(viewportHeight: number): number {
  return viewportHeight * (MOBILE_VIEWPORT.width / MOBILE_VIEWPORT.height)
}

export function mobileViewportSizeForHeight(viewportHeight: number): {
  height: number
  width: number
} {
  return {
    height: viewportHeight,
    width: mobileDisplayWidthForViewportHeight(viewportHeight),
  }
}

/**
 * Mobile frame width required for its viewport height to match a desktop frame.
 * Both widths are display pixels; the result is independent of capture scale.
 */
export function equalHeightMobileWidthForDesktopWidth(
  desktopWidth: number
): number {
  const desktopHeight =
    desktopWidth * (DESKTOP_VIEWPORT.height / DESKTOP_VIEWPORT.width)
  return mobileDisplayWidthForViewportHeight(desktopHeight)
}
