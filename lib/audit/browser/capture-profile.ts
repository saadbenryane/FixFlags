import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'

export interface CaptureProfile {
  name: 'desktop' | 'mobile'
  width: number
  height: number
  deviceScaleFactor?: number
  isMobile?: boolean
  userAgent: string
}

/** Realistic Chrome user agents for consistent site routing (not headless defaults). */
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1'

export const DESKTOP_CAPTURE_PROFILE: CaptureProfile = {
  name: 'desktop',
  width: DESKTOP_VIEWPORT.width,
  height: DESKTOP_VIEWPORT.height,
  isMobile: false,
  userAgent: DESKTOP_USER_AGENT,
}

export const MOBILE_CAPTURE_PROFILE: CaptureProfile = {
  name: 'mobile',
  width: MOBILE_VIEWPORT.width,
  height: MOBILE_VIEWPORT.height,
  deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
  isMobile: true,
  userAgent: MOBILE_USER_AGENT,
}

export function profileForDevice(device: 'desktop' | 'mobile'): CaptureProfile {
  return device === 'mobile' ? MOBILE_CAPTURE_PROFILE : DESKTOP_CAPTURE_PROFILE
}
