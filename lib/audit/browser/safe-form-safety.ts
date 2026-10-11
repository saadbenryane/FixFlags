import { isBlockedPaymentUrl, isCartMutationPath, isLikelyDownloadUrl } from './journey-safety'

/** An authorized Signup fixture is not authorization for other origins or purchases. */
export function safeFormRequestAllowed(input: { url: string; method: string; navigation: boolean; origin: string; values: readonly string[] }) {
  try {
    const url = new URL(input.url), sameOrigin = url.origin === input.origin
    if (isBlockedPaymentUrl(input.url) || isLikelyDownloadUrl(input.url)) return false
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(input.method.toUpperCase())
    if ((mutation || input.navigation) && !sameOrigin) return false
    if (mutation && isCartMutationPath(input.url)) return false
    const transmitted = [...url.searchParams.values(), decodeURIComponent(url.pathname)]
    if (!sameOrigin && input.values.some(value => value.length > 0 &&
      transmitted.some(parameter => parameter === value || value.length > 3 && parameter.includes(value)))) return false
    return true
  } catch { return false }
}
