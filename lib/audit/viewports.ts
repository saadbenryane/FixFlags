/** Puppeteer capture viewports — UI screenshot frames use matching aspect ratios. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 900 }
export const MOBILE_VIEWPORT = { width: 375, height: 812 }

export const SCREENSHOT_FRAME = {
  desktop: {
    label: 'Desktop',
  },
  mobile: {
    label: 'Mobile',
  },
} as const
