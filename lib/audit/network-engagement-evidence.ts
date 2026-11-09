import { z } from 'zod'
import { capturePageKey } from './browser/observation-scope'

export const MAX_ENGAGEMENT_REQUESTS = 64
export const engagementRequestSchema = z.object({
  requestKey: z.string().regex(/^[a-f0-9]{64}$/),
  redirectKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  captureKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  actionKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  phase: z.enum(['page_load', 'public_action']), method: z.string().min(1).max(32),
  destination: z.string().max(600), status: z.number().int().min(100).max(599).nullable(),
  state: z.enum(['pending', 'response', 'completed', 'failed']),
  responseKind: z.enum(['challenge', 'unexpected_html']).optional(),
}).strict()
export const engagementEvidenceSchema = z.object({ version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  requests: z.array(engagementRequestSchema).max(MAX_ENGAGEMENT_REQUESTS), truncated: z.boolean() }).strict()
export type EngagementRequest = z.infer<typeof engagementRequestSchema>
export type EngagementEvidence = z.infer<typeof engagementEvidenceSchema>
export const ENGAGEMENT_VERIFICATION_RULE = 'Engagement network observation v1: repeat every original request, page, phase, control and native capture identity. Missing requests or a different access response cannot certify repair.'
export const ENGAGEMENT_CONTEXT = /^engagement:(?:page_load:control:page:request:v[124]|public_action:control:[a-f0-9]{64}:request:v[1234]):[a-f0-9]{64}:capture:[a-f0-9]{64}:page:[a-f0-9]{64}$/

export function currentEngagementResponseObservation(assertion: { key: string; passed: boolean; context?: string }) {
  return !assertion.passed || !/^(engagement|form)-(auth|server)-response$/.test(assertion.key) ||
    Boolean(assertion.context && ENGAGEMENT_CONTEXT.test(assertion.context) && assertion.context.includes(':request:v4:'))
}

export function engagementContext(request: EngagementRequest, pageUrl: string, version: EngagementEvidence['version'] = 1) {
  const control = request.phase === 'page_load' ? 'page' : request.actionKey
  // Only current request-time captures can establish a control. Keep the
  // older receipt contexts readable without generating them for new actions.
  if (!request.captureKey || !control || request.phase === 'public_action' && version === 1) return undefined
  const contextVersion = version === 3 ? 4 : request.phase === 'public_action' ? 3 : version
  const requestKey = version === 3 ? request.redirectKey ?? request.requestKey : request.requestKey
  return `engagement:${request.phase}:control:${control}:request:v${contextVersion}:${requestKey}:capture:${request.captureKey}:page:${capturePageKey(pageUrl)}`
}
export function engagementActionContext(target: unknown) {
  const parsed = z.object({ context: z.string().regex(ENGAGEMENT_CONTEXT) }).safeParse(target)
  const control = parsed.success ? parsed.data.context.match(/^engagement:public_action:control:([a-f0-9]{64}):/)?.[1] : undefined
  return control ? 'flow:control:' + control : undefined
}
