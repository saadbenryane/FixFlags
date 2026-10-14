import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'
import type { CaptureProfile } from './capture-profile'
import type { ScanAccessConfig } from '../scan-access'
import { canonicalIntent } from '@/lib/sites/domain/execution-spec'
import type { Page } from 'playwright'

export const captureObservationScopeSchema = z.object({
  pageUrl: z.string().url(), finalUrl: z.string().url(), profile: z.string().min(1), access: z.string().min(1),
}).strict()
export type CaptureObservationScope = z.infer<typeof captureObservationScopeSchema>
export function captureProfileKey(profile: CaptureProfile) {
  const conditions = ['native-request-boundary-v1', profile.width, profile.height, profile.userAgent, profile.deviceScaleFactor ?? 1, profile.isMobile ?? false, 'en-US']
  if (profile.hasTouch) conditions.push('touch-input')
  return createHash('sha256').update(JSON.stringify(conditions)).digest('hex')
}
/** Fragment routes can change browser behavior without a new HTTP document. */
export function capturePageKey(pageUrl: string) { return createHash('sha256').update(new URL(pageUrl).href).digest('hex') }
/** Compare executable access conditions without retaining secrets or an unkeyed credential hash. */
export function captureAccessKey(access?: ScanAccessConfig | null, targetUrl?: string) {
  if (!access || !access.httpBasic && !access.cookies?.length && !Object.keys(access.headers ?? {}).length) return 'public'
  const key = process.env.TOKEN_ENCRYPTION_KEY
  const { httpBasic, cookies, headers } = access
  const approvedOriginReplay = access.origin && targetUrl && (httpBasic || Object.keys(headers ?? {}).length > 0) &&
    new URL(access.origin).origin !== new URL(targetUrl).origin
  return key ? 'credentialed:' + createHmac('sha256', key).update(canonicalIntent({ httpBasic, cookies, headers,
    ...(access.origin ? { origin: access.origin } : {}), ...(approvedOriginReplay ? { replay: 'approved-origin-v1' } : {}) })).digest('hex') : 'credentialed:unknown'
}
export function captureObservationKey(scope: CaptureObservationScope) {
  if (scope.access.endsWith(':unknown')) return 'unknown'
  return createHash('sha256').update(canonicalIntent({ ...scope, pageUrl: new URL(scope.pageUrl).href, finalUrl: new URL(scope.finalUrl).href })).digest('hex')
}

const pageSources = new WeakMap<Page, { pageUrl: string; profile: CaptureProfile; access: string; restrictions: string[] }>()
/** Retain only executable capture conditions, never credentials, on a live page. */
export function bindAuditPageObservation(page: Page, pageUrl: string, profile: CaptureProfile, access: ScanAccessConfig | null | undefined, restrictions: string[], storageState?: import('playwright').BrowserContextOptions['storageState']) {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  const identity = storageState ? key && typeof storageState !== 'string'
    ? 'credentialed:' + createHmac('sha256', key).update(canonicalIntent([captureAccessKey(access, pageUrl), storageState])).digest('hex') : 'credentialed:unknown' : captureAccessKey(access, pageUrl)
  pageSources.set(page, { pageUrl, profile: { ...profile }, access: identity, restrictions })
}
export function auditPageObservation(page: Page) {
  const source = pageSources.get(page)
  if (!source) return undefined
  const viewport = page.viewportSize()
  return { device: source.profile.name, restricted: source.restrictions.length > 0,
    scope: { pageUrl: source.pageUrl, finalUrl: page.url(), access: source.access,
      profile: captureProfileKey({ ...source.profile, ...(viewport ? { width: viewport.width, height: viewport.height } : {}) }) } }
}
