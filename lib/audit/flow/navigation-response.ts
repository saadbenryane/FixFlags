import type { Page, Response } from 'playwright'
import { isBotInterstitialPage } from '../browser/page-capture'
import { observeRenderedCopy } from '../browser/rendered-copy'
import type { PrimaryActionEvidence } from './primary-action-evidence'

/** Classify the actual reached document, never a second request to its URL. */
export async function observeNavigationResponse(page: Page, response: Response | null) {
  const pageUrl = page.url(), status = response?.status() ?? null
  const [title, copy] = await Promise.all([page.title().catch(() => null), observeRenderedCopy(page).catch(() => null)])
  const sameDocument = page.url() === pageUrl && copy?.pageUrl === pageUrl
  const challenge = isBotInterstitialPage({ title, cfMitigated: response?.headers()['cf-mitigated'] }) ||
    sameDocument && isBotInterstitialPage({ title: copy?.h1s[0] })
  let matches = false
  if (response) {
    const received = new URL(response.url()), observed = new URL(pageUrl)
    received.hash = ''; observed.hash = ''
    matches = received.href === observed.href
  }
  const state: PrimaryActionEvidence['response'] = challenge ? 'challenge' : !matches || !status ? 'unknown'
    : [401, 403, 429].includes(status) ? 'restricted' : status >= 400 ? 'error'
      : status >= 200 && status < 300 && title !== null && sameDocument && copy?.complete ? 'healthy' : 'unknown'
  return { state, pageUrl, status, copy: sameDocument ? copy : null }
}
