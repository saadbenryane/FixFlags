import { z } from 'zod'

const pricingPrefix = 'flow:pricing:v[12]:'
const digest = '[a-f0-9]{64}'
export const pricingNavigationContextSchema = z.string().regex(new RegExp(`^${pricingPrefix}${digest}$`))

// Admission, queued control work and historical Watch reads share this pattern.
export const ACTION_CONTEXT_PATTERN = `^(form:|flow:control:|${pricingPrefix})${digest}$`
export const actionContextSchema = z.string().regex(new RegExp(ACTION_CONTEXT_PATTERN))

export function primaryActionControlKey(context: string | null | undefined): string | undefined {
  return context?.match(/^flow:control:([a-f0-9]{64})$/)?.[1]
}

export const PRIMARY_ACTION_RESPONSE_CONTEXT = /^flow:response:v1:([a-f0-9]{64}):[a-f0-9]{64}$/

export function primaryActionResponseControl(context: string | undefined) {
  const control = context?.match(PRIMARY_ACTION_RESPONSE_CONTEXT)?.[1]
  return control ? 'flow:control:' + control : undefined
}
