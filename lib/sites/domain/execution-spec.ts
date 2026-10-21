import { z } from 'zod'
import { accountIntentSchema } from '../accounts/contracts'

export const categoryAreaSchema = z.enum(['search', 'performance', 'conversion', 'security', 'tracking', 'accessibility'])
export type CategoryArea = z.infer<typeof categoryAreaSchema>

const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]))
export const executionBindingSchema = z.object({
  key: z.string().min(1), version: z.number().int().positive(), mechanism: z.enum(['BROWSER_JOURNEY', 'HTTP_AVAILABILITY', 'SAFE_FORM']),
  required: z.boolean(), config: jsonValue, scope: jsonValue.optional(), configurationError: z.string().optional(),
  fixture: z.object({ id: z.string().min(1), version: z.number().int().positive() }).optional(),
}).strict()
export const verificationTargetSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('OUTCOME'), outcomeId: z.string().min(1), attemptId: z.string().min(1), parentAuditId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('DIAGNOSTIC'), pageUrl: z.string().url(), checkId: z.string().min(1), attemptId: z.string().min(1), parentAuditId: z.string().min(1) }).strict(),
  ])
import { scanAccessIntentSchema } from '@/lib/audit/scan-access-intent'
export const monitoredBehaviorSchema = z.enum(['flow', 'pricing-navigation', 'slow-replay', 'journeys'])
export const executionSpecSchema = z.object({
  scanAccess: scanAccessIntentSchema.optional(),
  engine: z.literal('progressive-v1').optional(),
  reviewDepth: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  monitoringPages: z.array(z.string().url()).min(1).max(24).optional(),
  monitoringBehaviors: z.array(z.object({ pageUrl: z.string().url(), behaviors: z.array(monitoredBehaviorSchema).min(1).max(4) }).strict()).min(1).max(24).optional(),
  // Historical snapshots retain their original entry-role contract. New admission records behaviors.
  monitoringEntryPages: z.array(z.string().url()).min(1).max(24).optional(),
  consoleObservationMs: z.number().int().min(0).max(90000).optional(),
  consoleObservationScopes: z.array(z.object({ pageUrl: z.string().url(), minimumMs: z.number().int().min(2000).max(90000) }).strict()).max(100).optional(),
  version: z.literal(1), targetUrl: z.string().url(), environment: z.string().min(1),
  scope: z.enum(['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC', 'FIXTURE_SETUP', 'ACCOUNT_CHECKS']),
  category: z.object({ area: categoryAreaSchema, sourceAuditId: z.string().min(1), pages: z.array(z.string().url()).min(1).max(24) }).strict().optional(),
  verificationScopes: z.array(z.object({ pageUrl: z.string().url(), phases: z.array(z.enum(['page_load', 'public_action'])).max(2),
    overlayPhases: z.array(z.string().regex(/^(page_load|primary_action(?:_after)?|pricing_navigation(?:_after)?|(?:flow_)?form_validation(?:_after)?|journey_[a-z0-9_-]+)$/).max(160)).max(100).optional() }).strict()).max(100).optional(),
  accountChecks: accountIntentSchema.optional(),
  fixtureSetup: z.object({ id: z.string().min(1), version: z.number().int().positive() }).strict().optional(),
  checks: z.record(z.string(), z.number().int().positive()),
  outcomes: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1), expectation: z.string().nullable(),
    bindingPolicy: z.string(), bindings: z.array(executionBindingSchema) }).strict()),
  verificationTarget: verificationTargetSchema.nullable(),
}).strict().superRefine((spec, context) => {
  if (spec.monitoringPages && (spec.scope !== 'SITE' || spec.monitoringPages[0] !== spec.targetUrl || new Set(spec.monitoringPages).size !== spec.monitoringPages.length))
    context.addIssue({ code: 'custom', message: 'Invalid monitoring page scope' })
  if (spec.monitoringBehaviors) {
    const pages = spec.scope === 'SITE' ? spec.monitoringPages ?? [spec.targetUrl] : spec.scope === 'CATEGORY' ? spec.category?.pages : undefined
    if (!pages || new Set(spec.monitoringBehaviors.map(item => item.pageUrl)).size !== spec.monitoringBehaviors.length ||
      spec.monitoringBehaviors.some(item => !pages.includes(item.pageUrl) || new Set(item.behaviors).size !== item.behaviors.length))
      context.addIssue({ code: 'custom', message: 'Invalid monitoring behavior scope' })
  }
  if (spec.monitoringEntryPages) {
    const pages = spec.scope === 'SITE' ? spec.monitoringPages ?? [spec.targetUrl] : spec.scope === 'CATEGORY' ? spec.category?.pages : undefined
    if (!pages || new Set(spec.monitoringEntryPages).size !== spec.monitoringEntryPages.length || spec.monitoringEntryPages.some(page => !pages.includes(page)))
      context.addIssue({ code: 'custom', message: 'Invalid monitoring entry scope' })
  }
  if ((spec.scope === 'CATEGORY') !== Boolean(spec.category) || spec.scope === 'CATEGORY' &&
    (spec.verificationTarget || spec.category!.pages[0] !== spec.targetUrl || new Set(spec.category!.pages).size !== spec.category!.pages.length))
    context.addIssue({ code: 'custom', message: 'Invalid category scope' })
  if (spec.scope === 'ACCOUNT_CHECKS' && (!spec.accountChecks || spec.outcomes.length || spec.verificationTarget))
    context.addIssue({ code: 'custom', message: 'Invalid account check scope' })
  if ((spec.scope === 'FIXTURE_SETUP') !== Boolean(spec.fixtureSetup) ||
    spec.scope === 'FIXTURE_SETUP' && (spec.outcomes.length > 0 || spec.verificationTarget !== null || Object.keys(spec.checks).length > 0))
    context.addIssue({ code: 'custom', message: 'Invalid fixture setup scope' })
})
export type ExecutionSpec = z.infer<typeof executionSpecSchema>

export function readExecutionSpec(value: unknown): ExecutionSpec | null {
  const parsed = executionSpecSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function readVerificationTarget(value: unknown) {
  const parsed = verificationTargetSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Canonical intent includes executable data. Presentation and timestamps never change replay identity. */
export function canonicalIntent(value: unknown): string {
  function sorted(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sorted)
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, sorted(v)]))
    return item
  }
  return JSON.stringify(sorted(value))
}
