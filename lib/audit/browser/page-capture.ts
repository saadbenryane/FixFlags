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

/**
 * Cloudflare bot interstitials often return HTML 200 with a challenge
 * document. That is not the Product. Do not treat a Turnstile widget on a
 * real page as a block; those keep the Product title.
 */
export function isBotInterstitialPage(input: {
  title?: string | null
  cfMitigated?: string | null
}): boolean {
  if ((input.cfMitigated ?? '').trim().toLowerCase() === 'challenge') return true
  const title = (input.title ?? '').trim().toLowerCase()
  if (!title) return false
  return title.startsWith('just a moment') || title.startsWith('attention required')
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
