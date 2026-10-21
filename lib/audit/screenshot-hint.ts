export type ScreenshotHint = 'no-screenshot' | 'desktop-only' | 'mobile-only' | 'desktop-and-mobile'

export function getScreenshotHint(desktopBase64: string | null, mobileBase64: string | null): ScreenshotHint {
  if (desktopBase64 && mobileBase64) return 'desktop-and-mobile'
  if (desktopBase64) return 'desktop-only'
  if (mobileBase64) return 'mobile-only'
  return 'no-screenshot'
}
