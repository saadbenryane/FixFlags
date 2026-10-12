import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'
import type { CaptureProfile } from './capture-profile'
import type { ScanAccessConfig } from '../scan-access'
import { canonicalIntent } from '@/lib/sites/domain/execution-spec'

export const captureObservationScopeSchema = z.object({
  pageUrl: z.string().url(), finalUrl: z.string().url(), profile: z.string().min(1), access: z.string().min(1),
}).strict()
export type CaptureObservationScope = z.infer<typeof captureObservationScopeSchema>
export function captureProfileKey(profile: CaptureProfile) {
  return createHash('sha256').update(JSON.stringify([profile.width, profile.height, profile.userAgent, profile.deviceScaleFactor ?? 1, profile.isMobile ?? false, 'en-US'])).digest('hex')
}
/** Fragment routes can change browser behavior without a new HTTP document. */
export function capturePageKey(pageUrl: string) { return createHash('sha256').update(new URL(pageUrl).href).digest('hex') }
/** Compare executable access conditions without retaining secrets or an unkeyed credential hash. */
export function captureAccessKey(access?: ScanAccessConfig | null) {
  if (!access || !access.httpBasic && !access.cookies?.length && !Object.keys(access.headers ?? {}).length) return 'public'
  const key = process.env.TOKEN_ENCRYPTION_KEY
  const { httpBasic, cookies, headers } = access
  return key ? 'credentialed:' + createHmac('sha256', key).update(canonicalIntent({ httpBasic, cookies, headers })).digest('hex') : 'credentialed:unknown'
}
export function captureObservationKey(scope: CaptureObservationScope) {
  if (scope.access.endsWith(':unknown')) return 'unknown'
  return createHash('sha256').update(canonicalIntent({ ...scope, pageUrl: new URL(scope.pageUrl).href, finalUrl: new URL(scope.finalUrl).href })).digest('hex')
}
