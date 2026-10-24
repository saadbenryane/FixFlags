import { z } from 'zod'
import { CHECK_OBSERVATION_REASONS, type CheckAssertion } from './assertion'
import { CHECK_ASSERTIONS, CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import type { DeterministicFlag } from '../flag-types'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { currentFormFeedbackObservation } from './form-validation'

/** Shared modules can observe several areas. Select admitted evidence before
 * deriving completeness, so unrelated measurements cannot decide this result. */
export function scopeCheckEvidence(input: {
  module: string; flags: DeterministicFlag[]; assertions: CheckAssertion[];
  scope?: { area?: SiteCardArea; allowedCheckIds?: readonly string[] };
}) {
  if (!input.scope?.allowedCheckIds) return { flags: input.flags, assertions: input.assertions }
  const allowed = new Set(input.scope.allowedCheckIds)
  return {
    flags: input.flags.filter(flag => allowed.has(flag.checkId.split('::page:')[0])),
    assertions: input.assertions.filter(assertion => {
      const definition = CHECK_ASSERTIONS[input.module]?.[assertion.key]
      return definition && (definition.area === input.scope?.area || definition.verifies.some(id => allowed.has(id)))
    }),
  }
}

export const checkAssertionSchema = z.object({
  reason: z.enum(CHECK_OBSERVATION_REASONS).optional(),
  key: z.string().min(1).max(160), name: z.string().min(1).max(300),
  expected: z.string().min(1).max(2000), observed: z.string().min(1).max(2000),
  passed: z.boolean(), disposition: z.literal('observed').optional(),
  complete: z.boolean().optional(), context: z.string().min(1).max(4200).optional(),
  measurements: z.array(z.object({ context: z.string().min(1).max(4200), passed: z.boolean(),
    observed: z.string().min(1).max(2000) }).strict()).max(8).refine(items => new Set(items.map(item => item.context)).size === items.length,
    'Duplicate measured scope').optional(),
  targets: z.array(z.object({ selector: z.string().min(1).max(2000), label: z.string().min(1).max(160), context: z.string().min(1).max(4200).optional() }).strict()).max(200).optional(),
})

export const checkReceiptSchema = z.object({
  kind: z.literal('site-module-check'), version: z.literal(1), module: z.string().min(1),
  passed: z.boolean(), applicable: z.boolean(), failed: z.boolean().optional(),
  complete: z.boolean().optional(), limitation: z.string().max(2000).optional(),
  pageUrl: z.string().url(), assertions: z.array(checkAssertionSchema).max(300).default([]),
  execution: z.object({ auditId: z.string().min(1), taskId: z.string().min(1), checkVersion: z.number().int().positive(),
    /** Individual check identities admitted in the frozen execution scope. */
    checkVersions: z.record(z.string().min(1).max(200), z.number().int().positive()).refine(value => Object.keys(value).length <= 1000, 'Too many check versions').optional(),
    source: z.enum(['http', 'original-html', 'rendered-dom', 'pagespeed-desktop', 'pagespeed-mobile', 'axe', 'keyboard', 'browser-network', 'browser-console', 'browser-accessibility']),
    collectedAt: z.string().datetime() }).strict().optional(),
}).superRefine((receipt, context) => {
  if (!CHECK_MODULES[receipt.module]) context.addIssue({ code: 'custom', message: 'Unregistered execution module' })
  for (const id of Object.keys(receipt.execution?.checkVersions ?? {})) {
    if (CHECK_REGISTRY[id]?.module !== receipt.module) context.addIssue({ code: 'custom', message: 'Check version outside execution module' })
  }
  for (const assertion of receipt.assertions) {
    if (!CHECK_ASSERTIONS[receipt.module]?.[assertion.key]) context.addIssue({ code: 'custom', message: 'Unregistered assertion identity' })
  }
})

/** New receipts distinguish module implementation from admitted check identities.
 * Historical receipts retain only their recorded module version. An explicit
 * map missing the requested identity never falls back to another version. */
export function recordedCheckVersion(receipt: z.infer<typeof checkReceiptSchema>, checkId: string): number | undefined {
  if (!receipt.execution) return undefined
  return receipt.execution.checkVersions !== undefined
    ? receipt.execution.checkVersions[checkId] : receipt.execution.checkVersion
}

/** Advisory evidence cannot verify repair, but unfinished observations still
 * leave the inspection incomplete. Stored summary bits never override facts. */
export function summarizeCheckAssertions(input: { passed: boolean; complete?: boolean; failed?: boolean;
  assertions: ReadonlyArray<Pick<CheckAssertion, 'passed' | 'complete' | 'disposition'>> }) {
  const incomplete = input.failed === true || input.complete === false || input.assertions.some(assertion => assertion.complete === false)
  const failed = input.assertions.some(assertion => assertion.complete !== false && !assertion.passed && assertion.disposition !== 'observed')
  return { passed: input.passed && input.failed !== true && !incomplete && !failed,
    ...(incomplete ? { complete: false } : input.complete !== undefined ? { complete: input.complete } : {}) }
}

/** Historical receipts have no version. Only explicitly recorded, valid fields survive. */
export function readCheckReceipt(detail: unknown) {
  const current = checkReceiptSchema.safeParse(detail)
  if (current.success) {
    let qualified = current.data
    if (qualified.module === 'form-validation') qualified = { ...qualified,
      assertions: current.data.assertions.map(assertion => currentFormFeedbackObservation(assertion) ? assertion : { ...assertion, complete: false }),
    }
    // Retain genuine HTTP facts without inventing historical pixel decoding.
    if (qualified.module === 'og-image' && qualified.assertions.some(assertion => assertion.key === 'preview-image-response' && assertion.passed) &&
      !qualified.assertions.some(assertion => assertion.key === 'preview-image-decoding')) qualified = { ...qualified, complete: false }
    return { ...qualified, ...summarizeCheckAssertions(qualified), legacy: false }
  }
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return { passed: undefined, assertions: [], legacy: true }
  const old = detail as Record<string, unknown>
  if (old.version !== undefined) return { passed: undefined, assertions: [], legacy: true }
  const assertions = Array.isArray(old.assertions) ? old.assertions.slice(0, 300).flatMap(value => {
    const parsed = checkAssertionSchema.safeParse(value)
    return parsed.success ? [currentFormFeedbackObservation(parsed.data) ? parsed.data : { ...parsed.data, complete: false }] : []
  }) : []
  const currentAssertions = assertions.some(assertion => assertion.key === 'preview-image-decoding') ? assertions
    : assertions.map(assertion => assertion.key === 'preview-image-response' && assertion.passed ? { ...assertion, complete: false } : assertion)
  return { passed: typeof old.passed === 'boolean' ? old.passed : undefined, assertions: currentAssertions, legacy: true }
}
