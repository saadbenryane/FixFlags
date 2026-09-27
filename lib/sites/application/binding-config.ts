import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { z } from 'zod'

const url = z.string().url().max(2048)

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

export type CheckoutBindingConfig = z.infer<typeof checkoutBindingConfigSchema>
export type AvailabilityBindingConfig = z.infer<typeof availabilityBindingConfigSchema>
export type SafeFormBindingConfig = z.infer<typeof safeFormBindingConfigSchema>
export type ValidatedBindingConfig =
  | { mechanism: 'BROWSER_JOURNEY'; config: CheckoutBindingConfig }
  | { mechanism: 'HTTP_AVAILABILITY'; config: AvailabilityBindingConfig }
  | { mechanism: 'SAFE_FORM'; config: SafeFormBindingConfig }

export function validateBindingConfig(
  mechanism: OutcomeExecutionMechanism,
  value: Prisma.JsonValue,
): { success: true; data: ValidatedBindingConfig } | { success: false; reason: string } {
  const schema = mechanism === 'BROWSER_JOURNEY'
    ? checkoutBindingConfigSchema
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
