import * as cheerio from 'cheerio'
import type { Page } from 'playwright'
import { isPublicChallengeHeader, publicResponseStatusRestriction } from '../http-evidence'
import { hasAuthenticationPath } from '../url-identity'

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
  if (isPublicChallengeHeader(input.cfMitigated)) return true
  const title = (input.title ?? '').trim().toLowerCase()
  if (!title) return false
  return title.startsWith('just a moment') || title.startsWith('attention required') ||
    /^(?:verify (?:that )?you are (?:a )?human|checking (?:your )?browser|captcha|access denied)[.!]*$/i.test(title)
}

type PublicResponseCues = { titles: readonly string[]; headings: readonly string[]; text: string }
export type PublicResponseContent = { body: string | null; fragments?: readonly string[] } | { cues: PublicResponseCues }

function isBotInterstitialResponse(input: { headers: Record<string, string>; status: number }, readCues: () => PublicResponseCues) {
  if (isBotInterstitialPage({ cfMitigated: input.headers['cf-mitigated'] })) return true
  if (/^image\//i.test(input.headers['content-type'] ?? '')) return false
  const { titles, headings, text } = readCues()
  if (isBotInterstitialPage({ title: titles[0] }) || isBotInterstitialPage({ title: headings[0] })) return true
  return input.status >= 400 && /^(?:checking your browser|access denied|verify you are human)\b/i.test(text.replace(/\s+/g, ' ').trim())
}

/** Share browser challenge policy with bounded public HTTP observations.
 * Provider names, script URLs and embedded CAPTCHA widgets are not a wall. */
export function isBotInterstitialDocument(input: { body: string; headers: Record<string, string>; status: number }): boolean {
  return isBotInterstitialResponse(input, () => {
    const $ = cheerio.load(input.body.slice(0, 64_000))
    // SVG titles and foreign objects describe the graphic, independently of the page.
    $('script, style, template, noscript, svg').remove()
    return { titles: [$('head > title').first().text()], headings: [$('body h1').first().text()],
      text: input.status >= 400 ? $('body').text() : '' }
  })
}

export const PUBLIC_SIGN_IN_REDIRECT = 'public_sign_in_redirect'
export const PARTIAL_PAGE_RESPONSE = 'HTTP_PARTIAL_RESPONSE'

export function isObservedPageCaptureFailure(code: string): boolean {
  return ['HTTP_ERROR', 'HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT', 'NON_HTML_RESPONSE',
    PUBLIC_SIGN_IN_REDIRECT, PARTIAL_PAGE_RESPONSE].includes(code)
}

function isPublicSignInDestination(requestedUrl: string, finalUrl: string, status: number): boolean {
  return status >= 200 && status < 300 && !hasAuthenticationPath(requestedUrl) && hasAuthenticationPath(finalUrl)
}

function hasPublicSignInCue(text: string): boolean {
  return /^(?:please\s+)?(?:sign[\s-]*in|log[\s-]*in|authentication required)\b/i.test(text.trim())
}

/** Qualify the active document without collecting its HTML or form values. */
export async function observePublicSignInRedirect(page: Page, requestedUrl: string, status: number | null): Promise<string | null> {
  const finalUrl = page.url()
  if (status === null || !isPublicSignInDestination(requestedUrl, finalUrl, status)) return null
  const observed = await page.evaluate(() => {
    const headings = document.querySelectorAll('body h1')
    const cues = [document.title.trim().slice(0, 256)]
    for (let i = 0; i < Math.min(headings.length, 10); i++) cues.push(headings[i].textContent?.trim().slice(0, 256) ?? '')
    return { url: location.href, cues }
  }).catch(() => null)
  return observed?.url === finalUrl && observed.cues.some(hasPublicSignInCue) ? finalUrl : null
}

/** An authentication-looking redirect also needs a sign-in cue in the page. */
export function isPublicSignInRedirect(input: { status: number; requestedUrl: string; finalUrl: string } & PublicResponseContent): boolean {
  if (!isPublicSignInDestination(input.requestedUrl, input.finalUrl, input.status)) return false
  if ('cues' in input) return input.cues.titles.some(hasPublicSignInCue) || input.cues.headings.some(hasPublicSignInCue)
  return [input.body, ...(input.fragments ?? [])].some(body => {
    if (!body) return false
    const $ = cheerio.load(body.slice(0, 64_000))
    $('script, style, template, noscript, svg').remove()
    return $('head > title, body h1').toArray().some(heading => hasPublicSignInCue($(heading).text()))
  })
}

/** Public page inspection cannot infer ordinary visitor behavior through an
 * authentication boundary, a forbidden response, rate limiting or a challenge. */
export function publicResponseRestriction(input: { headers: Record<string, string>; status: number } & PublicResponseContent) {
  const restriction = publicResponseStatusRestriction(input.status)
  if (restriction === 'intermediary_authentication_required') return restriction
  const challenge = 'cues' in input ? isBotInterstitialResponse(input, () => input.cues)
    : isBotInterstitialDocument({ ...input, body: input.body ?? '' })
  if (challenge) return 'bot_challenge' as const
  return restriction
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
