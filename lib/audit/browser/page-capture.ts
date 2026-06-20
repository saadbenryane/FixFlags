import type { CaptureProfile } from './capture-profile'

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

export function isHtmlContentType(contentType: string): boolean {
  if (!contentType) return false
  const lower = contentType.toLowerCase()
  return lower.includes('text/html') || lower.includes('application/xhtml+xml')
}

export async function pageHasHtmlDocument(page: import('puppeteer').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement?.tagName === 'HTML')
}

export async function validateNavigationResponse(
  response: { ok: () => boolean; status: () => number; headers: () => Record<string, string> } | null,
  finalUrl: string,
  page: import('puppeteer').Page
): Promise<void> {
  const contentType = response?.headers()['content-type']?.toLowerCase() ?? ''
  const httpStatus = response?.status() ?? null
  const statusOk =
    response != null &&
    (response.ok() || httpStatus === 304 || (httpStatus != null && httpStatus >= 200 && httpStatus < 400))

  const hasHtmlDocument = await pageHasHtmlDocument(page)
  const contentTypeOk = isHtmlContentType(contentType)

  if (!statusOk || (!contentTypeOk && !hasHtmlDocument)) {
    throw new PageCaptureError('Destination did not return a successful HTML document', {
      code:
        httpStatus === 403
          ? 'HTTP_FORBIDDEN'
          : httpStatus === 429
            ? 'HTTP_RATE_LIMIT'
            : contentTypeOk || hasHtmlDocument
              ? 'HTTP_ERROR'
              : 'NON_HTML_RESPONSE',
      httpStatus,
      contentType: contentType || null,
      finalUrl,
    })
  }
}

export async function applyCaptureProfile(
  page: import('puppeteer').Page,
  profile: CaptureProfile
): Promise<void> {
  await page.setUserAgent(profile.userAgent)
  await page.setViewport({
    width: profile.width,
    height: profile.height,
    isMobile: profile.isMobile,
    deviceScaleFactor: profile.deviceScaleFactor,
  })
}
