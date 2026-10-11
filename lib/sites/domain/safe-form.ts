import { z } from 'zod'

const roleSchema = z.enum(['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio'])
export const accessibleTargetSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('label'), value: z.string().min(1).max(200) }),
  z.object({ by: z.literal('placeholder'), value: z.string().min(1).max(200) }),
  z.object({ by: z.literal('role'), role: roleSchema, value: z.string().min(1).max(200) }),
])
export const safeFormMappingSchema = z.object({
  fields: z.record(z.string().min(1).max(80), accessibleTargetSchema), submit: accessibleTargetSchema,
})
export const safeFormValuesSchema = z.record(z.string().min(1).max(80), z.string().max(1000))
export const safeFormSuccessSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string().min(1).max(500) }),
  z.object({ type: z.literal('url'), value: z.string().url().max(2048) }),
  z.object({ type: z.literal('target'), target: accessibleTargetSchema }),
])
export type AccessibleTarget = z.infer<typeof accessibleTargetSchema>

/** The transport view cannot contain fixture values, ciphertext or hook secrets. */
export const outcomeFixtureViewSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(120), targetUrl: z.string().url(),
  fieldMapping: safeFormMappingSchema, successCriterion: safeFormSuccessSchema,
  resetUrl: z.string().url(), cleanupUrl: z.string().url(), version: z.number().int().positive(),
  lastDryRunVersion: z.number().int().positive().nullable(), lastDryRunAt: z.string().datetime().nullable(),
  // Historical dry runs remain their recorded JSON, not invented newer receipts.
  lastDryRunResult: z.json().nullable(), authorizedAt: z.string().datetime().nullable(), enabled: z.boolean(),
  hasValues: z.literal(true), hasHookSecret: z.boolean(),
}).strict()
