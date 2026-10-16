import * as cheerio from 'cheerio'

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
  return title.startsWith('just a moment') || title.startsWith('attention required') ||
    /^(?:verify (?:that )?you are (?:a )?human|checking (?:your )?browser|captcha|access denied)[.!]*$/i.test(title)
}

/** Share browser challenge policy with bounded public HTTP observations.
 * Provider names, script URLs and embedded CAPTCHA widgets are not a wall. */
export function isBotInterstitialDocument(input: { body: string; headers: Record<string, string>; status: number }): boolean {
  if (isBotInterstitialPage({ cfMitigated: input.headers['cf-mitigated'] })) return true
  if (/^image\//i.test(input.headers['content-type'] ?? '')) return false
  const $ = cheerio.load(input.body.slice(0, 64_000))
  $('script, style, template, noscript').remove()
  if (isBotInterstitialPage({ title: $('title').first().text() }) || isBotInterstitialPage({ title: $('h1').first().text() })) return true
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  return input.status >= 400 && /^(?:checking your browser|access denied|verify you are human)\b/i.test(text)
}

/** Public page inspection cannot infer ordinary visitor behavior through an
 * authentication boundary, a forbidden response, rate limiting or a challenge. */
export function publicResponseRestriction(input: { body: string; headers: Record<string, string>; status: number }) {
  if (isBotInterstitialDocument(input)) return 'bot_challenge' as const
  if (input.status === 401) return 'authentication_required' as const
  if (input.status === 403) return 'access_denied' as const
  if (input.status === 429) return 'rate_limited' as const
  return null
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
