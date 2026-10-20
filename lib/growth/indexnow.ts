import { load } from 'cheerio'
import { readDiscoveryBody } from './public-discovery'

export const INDEXNOW_KEY_PATH = '/indexnow-key.txt'
const ORIGIN = 'https://fixflags.com'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

export function validIndexNowKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{8,128}$/.test(value)
}

/** An explicit public-route allowlist prevents customer and arbitrary URLs entering notifications. */
export function indexNowPayload(paths: readonly string[], allowedPaths: readonly string[], key: string) {
  if (!validIndexNowKey(key)) throw new Error('IndexNow key is not configured')
  if (paths.length === 0 || paths.length > 200) throw new Error('Choose between 1 and 200 public paths')
  const allowed = new Set(allowedPaths)
  const unique = [...new Set(paths)]
  if (unique.some(path => !allowed.has(path) || !path.startsWith('/') || path.startsWith('//') || /[?#\\\s]/.test(path))) {
    throw new Error('Only registered public content paths can be notified')
  }
  return { host: 'fixflags.com', key, keyLocation: `${ORIGIN}${INDEXNOW_KEY_PATH}`, urlList: unique.map(path => `${ORIGIN}${path}`) }
}

/** Receipts mean notification acceptance only. Never emits a key, page content or provider body. */
export async function notifyIndexNow(input: {
  paths: readonly string[]; allowedPaths: readonly string[]; key: string; fetch?: typeof fetch
}) {
  const payload = indexNowPayload(input.paths, input.allowedPaths, input.key)
  const request = input.fetch ?? fetch
  const get = (url: string) => request(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'FixFlagsIndexNow/1.0' } })
  const keyResponse = await get(payload.keyLocation)
  if (keyResponse.status !== 200 || (await readDiscoveryBody(keyResponse)).trim() !== payload.key) {
    return { status: 'key-not-live', notifiedUrls: 0, indexingVerified: false }
  }
  for (const url of payload.urlList) {
    const response = await get(url)
    if (response.status !== 200 || !/text\/html/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel()
      return { status: 'content-not-live', notifiedUrls: 0, indexingVerified: false }
    }
    const text = await readDiscoveryBody(response)
    if (text.length > 2_000_000) return { status: 'content-unavailable', notifiedUrls: 0, indexingVerified: false }
    const html = load(text)
    const directives = [response.headers.get('x-robots-tag') ?? '', ...html('meta[name="robots"],meta[name="googlebot"],meta[name="bingbot"]')
      .map((_, element) => html(element).attr('content') ?? '').get()].join(',')
    const canonical = html('link[rel="canonical"]').attr('href')
    if (/\b(noindex|none)\b/i.test(directives) || !canonical || canonical.replace(/\/$/, '') !== url.replace(/\/$/, '') || html('link[rel="canonical"]').length !== 1) {
      return { status: 'content-ineligible', notifiedUrls: 0, indexingVerified: false }
    }
  }
  const response = await request(ENDPOINT, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload),
  })
  await response.body?.cancel()
  return { status: response.status === 200 ? 'notification-accepted' : response.status === 202 ? 'key-validation-pending' : 'notification-rejected',
    providerStatus: response.status, notifiedUrls: [200, 202].includes(response.status) ? payload.urlList.length : 0, indexingVerified: false }
}
