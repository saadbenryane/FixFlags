import { z } from 'zod'

export const FORM_VERIFICATION_RULE = 'Form validation probe: repeat empty-field validation on the same form and page without transmitting a submission.'
export const formEvidenceSchema = z.object({
  version: z.literal(1), pageUrl: z.string().url(), context: z.string().min(1).max(160),
  selector: z.string().min(1).max(2000), label: z.string().min(1).max(160),
  disposition: z.enum(['passed', 'failed', 'unknown']),
  reason: z.enum(['native_validation', 'native_feedback', 'client_feedback', 'missing_feedback', 'missing_submit', 'prefilled_fields',
    'preexisting_feedback', 'unscoped_feedback', 'submission_blocked', 'form_changed', 'form_unavailable', 'execution_interrupted', 'observation_incomplete', 'submit_handler_suppressed']),
  feedbackMs: z.number().finite().nonnegative().nullable(),
}).strict()
export type FormEvidence = z.infer<typeof formEvidenceSchema>
