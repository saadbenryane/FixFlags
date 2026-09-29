import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { z } from 'zod'

const url = z.string().url().max(2048)

const goalStepSchema = z.object({
  action: z.enum(['click', 'fill', 'wait', 'navigate']),
  role: z.enum(['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'tab', 'menuitem']).optional(),
  name: z.string().max(200).optional(),
  label: z.string().max(200).optional(),
  placeholder: z.string().max(200).optional(),
  selector: z.string().max(500).optional(),
  value: z.string().max(5000).optional(),
  url: url.optional(),
  waitMs: z.number().int().positive().max(30_000).optional(),
})

const goalDefinitionSchema = z.object({
  type: z.enum(['url_pattern', 'text_present', 'selector_present']),
  pattern: z.string().max(500).optional(),
  text: z.string().max(500).optional(),
  selector: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
})

export const browserJourneyConfigSchema = z.object({
  startUrl: url,
  steps: z.array(goalStepSchema).max(20),
  goal: goalDefinitionSchema,
  safety: z.enum(['none', 'stop-at-checkout', 'reversible']).default('none'),
  allowLocalhost: z.boolean().optional(),
})

export const checkoutBindingConfigSchema = z.object({
  startUrl: url,
  safety: z.literal('stop-at-checkout'),
})

export const availabilityBindingConfigSchema = z.object({
  startUrl: url,
  expectedText: z.string().min(1).max(500).optional(),
  expectedSelector: z.string().min(1).max(300).default('body'),
})

export const safeFormBindingConfigSchema = z.object({
  startUrl: url,
  safety: z.literal('reversible'),
  authorized: z.literal(true),
  fixtureId: z.string().min(1),
})

export type BrowserJourneyConfig = z.infer<typeof browserJourneyConfigSchema>
export type CheckoutBindingConfig = z.infer<typeof checkoutBindingConfigSchema>
export type AvailabilityBindingConfig = z.infer<typeof availabilityBindingConfigSchema>
export type SafeFormBindingConfig = z.infer<typeof safeFormBindingConfigSchema>
export type ValidatedBindingConfig =
  | { mechanism: 'BROWSER_JOURNEY'; config: BrowserJourneyConfig }
  | { mechanism: 'HTTP_AVAILABILITY'; config: AvailabilityBindingConfig }
  | { mechanism: 'SAFE_FORM'; config: SafeFormBindingConfig }

export function validateBindingConfig(
  mechanism: OutcomeExecutionMechanism,
  value: Prisma.JsonValue,
): { success: true; data: ValidatedBindingConfig } | { success: false; reason: string } {
  const schema = mechanism === 'BROWSER_JOURNEY'
    ? browserJourneyConfigSchema
    : mechanism === 'HTTP_AVAILABILITY'
      ? availabilityBindingConfigSchema
      : safeFormBindingConfigSchema
  const parsed = schema.safeParse(value)
  if (!parsed.success) return { success: false, reason: 'binding_configuration_invalid' }
  return {
    success: true,
    data: { mechanism, config: parsed.data } as ValidatedBindingConfig,
  }
}
