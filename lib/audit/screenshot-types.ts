export type ScreenshotDevice = 'DESKTOP' | 'MOBILE'

export type ScreenshotCaptureState = 'ok' | 'failed' | 'pending'

export interface AuditScreenshot {
  device: ScreenshotDevice
  url: string
  width: number
  height: number
}

export interface ScreenshotCaptureStatus {
  desktop: ScreenshotCaptureState
  mobile: ScreenshotCaptureState
}

export type CapturePresentation =
  | { state: 'pending' }
  | { state: 'complete' }
  | { state: 'partial'; failedDevices: ScreenshotDevice[] }
  | { state: 'unavailable'; failureCode: 'SCREENSHOT_CAPTURE_FAILED' }

export function normalizeInternalScreenshotUrl(url: string): string {
  if (url.startsWith('/api/screenshots/')) return url

  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/api/screenshots/')) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    return url
  }

  return url
}

export type CaptureFrameState = 'loaded' | 'failed' | 'loading'

export interface CapturePair {
  desktop: string | null
  mobile: string | null
  desktopState: CaptureFrameState
  mobileState: CaptureFrameState
}

/**
 * Shared desktop/mobile capture resolution. Loaded when a screenshot exists,
 * failed when capture reported failure, otherwise loading. Both the completed
 * browser panel and the progressive capture card project this pair.
 */
export function resolveCapturePair(
  screenshots: AuditScreenshot[],
  captureStatus?: ScreenshotCaptureStatus | null
): CapturePair {
  const desktopShot = screenshots.find((s) => s.device === 'DESKTOP')
  const mobileShot = screenshots.find((s) => s.device === 'MOBILE')
  const frameState = (
    shot: AuditScreenshot | undefined,
    status: ScreenshotCaptureState | undefined
  ): CaptureFrameState => (shot ? 'loaded' : status === 'failed' ? 'failed' : 'loading')

  return {
    desktop: desktopShot?.url ?? null,
    mobile: mobileShot?.url ?? null,
    desktopState: frameState(desktopShot, captureStatus?.desktop),
    mobileState: frameState(mobileShot, captureStatus?.mobile),
  }
}

export function resolveScreenshotPresentation(
  auditStatus: string,
  screenshots: AuditScreenshot[],
  captureStatus?: ScreenshotCaptureStatus | null
): CapturePresentation {
  const hasDesktop = screenshots.some((s) => s.device === 'DESKTOP')
  const hasMobile = screenshots.some((s) => s.device === 'MOBILE')
  const pastCapture = auditStatus !== 'QUEUED' && auditStatus !== 'CAPTURING'
  const desktop = hasDesktop ? 'ok' : captureStatus?.desktop ?? (pastCapture ? 'failed' : 'pending')
  const mobile = hasMobile ? 'ok' : captureStatus?.mobile ?? (pastCapture ? 'failed' : 'pending')

  if (!pastCapture && (desktop === 'pending' || mobile === 'pending')) {
    return { state: 'pending' }
  }
  if (desktop === 'ok' && mobile === 'ok') {
    return { state: 'complete' }
  }
  if (desktop === 'ok') {
    return { state: 'partial', failedDevices: ['MOBILE'] }
  }
  return { state: 'unavailable', failureCode: 'SCREENSHOT_CAPTURE_FAILED' }
}

export function parseScreenshotCaptureStatus(
  performanceData: unknown
): ScreenshotCaptureStatus | null {
  if (!performanceData || typeof performanceData !== 'object') return null
  const raw = (performanceData as { screenshots?: Partial<ScreenshotCaptureStatus> }).screenshots
  if (!raw || typeof raw !== 'object') return null

  const isState = (v: unknown): v is ScreenshotCaptureState =>
    v === 'ok' || v === 'failed' || v === 'pending'

  if (!isState(raw.desktop) && !isState(raw.mobile)) return null

  return {
    desktop: isState(raw.desktop) ? raw.desktop : 'pending',
    mobile: isState(raw.mobile) ? raw.mobile : 'pending',
  }
}

export function deriveScreenshotCaptureStatus(
  auditStatus: string,
  screenshots: Array<{ device: string }>,
  stored: ScreenshotCaptureStatus | null
): ScreenshotCaptureStatus {
  if (stored) return stored

  const hasDesktop = screenshots.some((s) => s.device === 'DESKTOP')
  const hasMobile = screenshots.some((s) => s.device === 'MOBILE')
  const pastCapture = auditStatus !== 'QUEUED' && auditStatus !== 'CAPTURING'

  return {
    desktop: hasDesktop ? 'ok' : pastCapture ? 'failed' : 'pending',
    mobile: hasMobile ? 'ok' : pastCapture ? 'failed' : 'pending',
  }
}
