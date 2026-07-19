export class PageCaptureError extends Error {
  readonly httpStatus: number | null
  readonly contentType: string | null
  readonly finalUrl: string | null
  readonly code: string

  constructor(
    message: string,
    details: {
      code: string
      httpStatus?: number | null
      contentType?: string | null
      finalUrl?: string | null
    }
  ) {
    super(message)
    this.name = 'PageCaptureError'
    this.code = details.code
    this.httpStatus = details.httpStatus ?? null
    this.contentType = details.contentType ?? null
    this.finalUrl = details.finalUrl ?? null
  }
}

export interface PageCaptureFailure {
  device: 'desktop' | 'mobile'
  code: string
  message: string
  httpStatus: number | null
  contentType: string | null
  finalUrl: string | null
}

export function pageCaptureFailureFromError(
  device: 'desktop' | 'mobile',
  err: unknown
): PageCaptureFailure {
  if (err instanceof PageCaptureError) {
    return {
      device,
      code: err.code,
      message: err.message,
      httpStatus: err.httpStatus,
      contentType: err.contentType,
      finalUrl: err.finalUrl,
    }
  }
  return {
    device,
    code: 'CAPTURE_FAILED',
    message: err instanceof Error ? err.message : String(err),
    httpStatus: null,
    contentType: null,
    finalUrl: null,
  }
}
