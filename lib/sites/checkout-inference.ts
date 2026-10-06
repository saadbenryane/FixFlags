import { isCheckoutUrl } from '@/lib/integrity/buy-controls'
import {
  isTerminalOrderUrl,
  stepRecordsBuyAction,
  type StoredPurchaseStep,
} from '@/lib/integrity/purchase'

export interface PurchaseFlagObservation {
  checkId?: string | null
  pageUrl?: string | null
}

export interface PurchaseStepObservation extends StoredPurchaseStep {
  url?: string | null
}

export interface PurchaseSurfaceObservation {
  siteUrl: string
  pageUrls?: readonly string[]
  flags?: readonly PurchaseFlagObservation[]
  steps?: readonly PurchaseStepObservation[]
  storefrontUrl?: string | null
}

/**
 * A Checkout promise needs a page where a buy can start.
 * Product, then an observed buy, then a purchase-attempt page, then a cart,
 * then a connected storefront. A checkout, payment, or thank-you URL is not a start.
 * A dead payment link on a page with no product or cart is a Flag, not this promise.
 */
export function observedPurchaseStart(input: PurchaseSurfaceObservation): string | null {
  const siteHost = hostOf(input.siteUrl)
  const pages = usable(input.pageUrls, siteHost, false)
  const buyPages = usable(
    (input.steps ?? []).filter((step) => step.url && stepRecordsBuyAction(step)).map((step) => step.url),
    siteHost,
    false,
  )
  const flagPages = usable(
    (input.flags ?? []).filter(flagMarksBuyAttempt).map((flag) => flag.pageUrl),
    siteHost,
    false,
  )
  const observed = [...pages, ...buyPages, ...flagPages]
  return (
    observed.find(isProductPath) ??
    buyPages[0] ??
    flagPages[0] ??
    observed.find(isCartPath) ??
    normalizeStart(input.storefrontUrl, siteHost, true)
  )
}

function flagMarksBuyAttempt(flag: PurchaseFlagObservation): boolean {
  const checkId = flag.checkId
  if (!checkId) return false
  if (checkId.startsWith('journey-checkout-failed-')) return true
  if (checkId === 'checkout-link-dead') return isBuyablePath(flag.pageUrl)
  if (/^(?:add(?:[-_\s]?to[-_\s]?cart)|buy[-_\s]?now)$/i.test(checkId)) return isBuyablePath(flag.pageUrl)
  return false
}

function isBuyablePath(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const pathname = new URL(url).pathname
    return /\/products?(?:\/|$)/i.test(pathname) || /\/cart(?:\/|$)/i.test(pathname)
  } catch {
    return false
  }
}

function usable(
  urls: readonly (string | null | undefined)[] | undefined,
  siteHost: string | null,
  allowOtherHost: boolean,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls ?? []) {
    const start = normalizeStart(url, siteHost, allowOtherHost)
    if (!start || seen.has(start)) continue
    seen.add(start)
    result.push(start)
  }
  return result
}

function normalizeStart(
  url: string | null | undefined,
  siteHost: string | null,
  allowOtherHost: boolean,
): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!allowOtherHost && (!siteHost || parsed.hostname !== siteHost)) return null
  parsed.hash = ''
  const start = parsed.toString()
  if (isCheckoutUrl(start) || isTerminalOrderUrl(start)) return null
  return start
}

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname
  } catch {
    return null
  }
}

function isProductPath(url: string): boolean {
  return /\/products?(?:\/|$)/i.test(new URL(url).pathname)
}

function isCartPath(url: string): boolean {
  return /\/cart(?:\/|$)/i.test(new URL(url).pathname)
}
