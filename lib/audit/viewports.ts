import type { CSSProperties } from 'react'

/** Puppeteer capture viewports, UI screenshot frames use matching aspect ratios. */
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

export const DESKTOP_FRAME_FLEX_CLASS = 'flex-1 min-w-0'

export const DESKTOP_FRAME_GRID_CLASS = 'min-w-0'

export const MOBILE_FRAME_WIDTH_CLASS = 'w-[240px] max-w-full shrink-0'

/**
 * Side-by-side desktop + mobile frames (flex row) for audit surfaces.
 * Pair with `flex` — do not include `flex` here or tailwind-merge will drop `hidden`.
 */
export const SCREENSHOT_FRAMES_ROW_CLASS =
  'w-full min-w-0 flex-row items-start gap-4 sm:gap-6'

/**
 * Side-by-side desktop + mobile screenshot grid for marketing sample.
 */
export const SCREENSHOT_FRAMES_GRID_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-3 sm:gap-6'

export function viewportAspectStyle(device: 'desktop' | 'mobile'): CSSProperties {
  const vp = device === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT
  return { aspectRatio: `${vp.width} / ${vp.height}` }
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
