import { z } from 'zod'
import type { CheckAssertion } from '../checks/assertion'

export const MAX_TRACKING_REQUESTS = 64
export const trackingProviderSchema = z.enum(['google-analytics', 'google-tag-manager', 'posthog', 'plausible', 'segment', 'vercel', 'cloudflare'])
export type TrackingProvider = z.infer<typeof trackingProviderSchema>
export const TRACKING_PROVIDERS: Record<TrackingProvider, string> = {
  'google-analytics': 'Google Analytics', 'google-tag-manager': 'Google Tag Manager', posthog: 'PostHog',
  plausible: 'Plausible', segment: 'Segment', vercel: 'Vercel Analytics', cloudflare: 'Cloudflare Web Analytics',
}
export const trackingRequestSchema = z.object({
  provider: trackingProviderSchema, role: z.enum(['library', 'event']), hostname: z.string().min(1).max(253),
  endpoint: z.string().min(1).max(160), method: z.enum(['GET', 'POST', 'HEAD', 'OPTIONS', 'OTHER']),
  phase: z.enum(['page_load', 'public_action']), state: z.enum(['pending', 'response', 'completed', 'failed', 'suppressed']),
  status: z.number().int().min(100).max(599).nullable(), reason: z.enum(['scanner_suppressed', 'browser_blocked', 'transport_failed']).nullable(),
  atMs: z.number().int().nonnegative(),
  requestKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  captureKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  actionKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  redirected: z.literal(true).optional(),
  responseKind: z.enum(['html', 'challenge', 'empty', 'script_mime']).optional(),
  eventResponseQualified: z.literal(true).optional(),
  libraryResponseQualified: z.literal(true).optional(),
}).strict()
export type TrackingRequest = z.infer<typeof trackingRequestSchema>
export const trackingEvidenceSchema = z.object({
  version: z.literal(1), phase: z.enum(['page_load', 'public_action']), requests: z.array(trackingRequestSchema).max(MAX_TRACKING_REQUESTS),
  truncated: z.boolean(), durationMs: z.number().int().nonnegative(),
  libraryObservationUnavailable: z.literal(true).optional(),
  consentInteraction: z.enum(['none', 'existing_flow']),
  // Earlier snapshots stored one capture identity for the entire phase.
  captureKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()
export type TrackingEvidence = z.infer<typeof trackingEvidenceSchema>

export function libraryResponseWithoutFullBody(request: TrackingRequest) {
  return request.role === 'library' && (request.status === 204 || request.status === 205 || request.status === 206 || request.status === 304)
}

/** Earlier successful receipts can lack the native response qualification. */
export function currentTrackingResponseObservation(assertion: Pick<CheckAssertion, 'key' | 'passed' | 'eventResponseQualified' | 'libraryResponseQualified'>) {
  if (!assertion.passed) return true
  if (assertion.key === 'tracking-http-response') return assertion.eventResponseQualified === true
  if (assertion.key === 'tracking-library') return assertion.libraryResponseQualified === true
  return true
}
