import { z } from 'zod'
import { capturePageKey } from './browser/observation-scope'

export const MAX_ENGAGEMENT_REQUESTS = 64
export const engagementRequestSchema = z.object({
  requestKey: z.string().regex(/^[a-f0-9]{64}$/),
  captureKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  phase: z.enum(['page_load', 'public_action']), method: z.string().min(1).max(32),
  destination: z.string().max(600), status: z.number().int().min(100).max(599).nullable(),
  state: z.enum(['pending', 'response', 'completed', 'failed']),
}).strict()
export const engagementEvidenceSchema = z.object({ version: z.literal(1),
  requests: z.array(engagementRequestSchema).max(MAX_ENGAGEMENT_REQUESTS), truncated: z.boolean() }).strict()
export type EngagementRequest = z.infer<typeof engagementRequestSchema>
export type EngagementEvidence = z.infer<typeof engagementEvidenceSchema>
export const ENGAGEMENT_VERIFICATION_RULE = 'Engagement network observation v1: repeat every original request, page, phase, control and native capture identity. Missing requests or a different access response cannot certify repair.'
export const ENGAGEMENT_CONTEXT = /^engagement:(page_load|public_action):control:(page|[a-f0-9]{64}):request:v1:[a-f0-9]{64}:capture:[a-f0-9]{64}:page:[a-f0-9]{64}$/

export function engagementContext(request: EngagementRequest, pageUrl: string, actionContext?: string) {
  const control = request.phase === 'page_load' ? 'page' : actionContext?.match(/^flow:control:([a-f0-9]{64})$/)?.[1]
  return request.captureKey && control ? `engagement:${request.phase}:control:${control}:request:v1:${request.requestKey}:capture:${request.captureKey}:page:${capturePageKey(pageUrl)}` : undefined
}
export function engagementActionContext(target: unknown) {
  const parsed = z.object({ context: z.string().regex(ENGAGEMENT_CONTEXT) }).safeParse(target)
  const control = parsed.success ? parsed.data.context.match(/^engagement:public_action:control:([a-f0-9]{64}):/)?.[1] : undefined
  return control ? 'flow:control:' + control : undefined
}
