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

export const MOBILE_FRAME_WIDTH_CLASS = 'w-[240px] max-w-full shrink-0'

/** Side-by-side desktop + mobile frames; stacks on the narrowest viewports. */
export const SCREENSHOT_FRAMES_ROW_CLASS =
  'flex w-full min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6'

export function viewportAspectStyle(device: 'desktop' | 'mobile'): CSSProperties {
  const vp = device === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT
  return { aspectRatio: `${vp.width} / ${vp.height}` }
}
