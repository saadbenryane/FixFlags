import { z } from 'zod'
import { CHECK_ASSERTIONS, CHECK_MODULES } from '../check-registry'

export const checkAssertionSchema = z.object({
  key: z.string().min(1).max(160), name: z.string().min(1).max(300),
  expected: z.string().min(1).max(2000), observed: z.string().min(1).max(2000),
  passed: z.boolean(),
})

export const checkReceiptSchema = z.object({
  kind: z.literal('site-module-check'), version: z.literal(1), module: z.string().min(1),
  passed: z.boolean(), applicable: z.boolean(), failed: z.boolean().optional(),
  pageUrl: z.string().url(), assertions: z.array(checkAssertionSchema).max(300).default([]),
}).superRefine((receipt, context) => {
  if (!CHECK_MODULES[receipt.module]) context.addIssue({ code: 'custom', message: 'Unregistered execution module' })
  for (const assertion of receipt.assertions) {
    if (!CHECK_ASSERTIONS[receipt.module]?.[assertion.key]) context.addIssue({ code: 'custom', message: 'Unregistered assertion identity' })
  }
})

/** Historical receipts have no version. Only explicitly recorded, valid fields survive. */
export function readCheckReceipt(detail: unknown) {
  const current = checkReceiptSchema.safeParse(detail)
  if (current.success) return { ...current.data, legacy: false }
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return { passed: undefined, assertions: [], legacy: true }
  const old = detail as Record<string, unknown>
  if (old.version !== undefined) return { passed: undefined, assertions: [], legacy: true }
  return { passed: typeof old.passed === 'boolean' ? old.passed : undefined,
    assertions: Array.isArray(old.assertions) ? old.assertions.slice(0, 300).flatMap(value => {
      const parsed = checkAssertionSchema.safeParse(value)
      return parsed.success ? [parsed.data] : []
    }) : [], legacy: true }
}
