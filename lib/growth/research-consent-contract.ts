import { z } from 'zod'

export const RESEARCH_CONSENT_VERSION = 'aggregate-research-v1'
export const RESEARCH_CONSENT_EVENT = 'public_research_consent'

export const researchConsentWriteSchema = z.strictObject({
  enabled: z.boolean(),
  policyVersion: z.string().max(80).optional(),
}).refine((value) => !value.enabled || value.policyVersion === RESEARCH_CONSENT_VERSION)

export const researchConsentPropertiesSchema = z.strictObject({
  enabled: z.boolean(),
  policyVersion: z.literal(RESEARCH_CONSENT_VERSION),
  siteIdentity: z.string().regex(/^[a-f0-9]{64}$/),
})

export const researchConsentViewSchema = z.strictObject({
  enabled: z.boolean(),
  policyVersion: z.literal(RESEARCH_CONSENT_VERSION),
  grantedAt: z.string().datetime().nullable(),
})
export type ResearchConsentView = z.infer<typeof researchConsentViewSchema>
