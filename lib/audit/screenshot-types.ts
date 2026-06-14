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

export interface ScreenshotUxState {
  limited: boolean
  partial: boolean
}

export function resolveScreenshotUx(
  screenshots: AuditScreenshot[],
  captureStatus?: ScreenshotCaptureStatus | null
): ScreenshotUxState {
  const hasDesktop = screenshots.some((s) => s.device === 'DESKTOP')
  const hasMobile = screenshots.some((s) => s.device === 'MOBILE')
  const limited = !hasDesktop
  const partial =
    hasDesktop && !hasMobile && captureStatus?.mobile === 'failed'
  return { limited, partial }
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
