import { z } from 'zod'

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
}).strict()
export type TrackingRequest = z.infer<typeof trackingRequestSchema>
export const trackingEvidenceSchema = z.object({
  version: z.literal(1), phase: z.enum(['page_load', 'public_action']), requests: z.array(trackingRequestSchema).max(MAX_TRACKING_REQUESTS),
  truncated: z.boolean(), durationMs: z.number().int().nonnegative(),
  consentInteraction: z.enum(['none', 'existing_flow']),
}).strict()
export type TrackingEvidence = z.infer<typeof trackingEvidenceSchema>
