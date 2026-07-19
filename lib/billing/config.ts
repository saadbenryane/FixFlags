/**
 * Stripe billing configuration helpers.
 * Price IDs and secrets come from env; mode is implied by key prefix (sk_test_ vs sk_live_).
 */

export const STRIPE_PRICE_ENV_KEYS = [
  'STRIPE_BUILDER_PRICE_ID',
  'STRIPE_TEAM_PRICE_ID',
  'STRIPE_CREDIT_PACK_10_ID',
  'STRIPE_CREDIT_PACK_25_ID',
  'STRIPE_CREDIT_PACK_50_ID',
] as const

export const STRIPE_CORE_ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const

export const STRIPE_ALL_ENV_KEYS = [
  ...STRIPE_CORE_ENV_KEYS,
  ...STRIPE_PRICE_ENV_KEYS,
] as const

export function missingStripeEnvVars(): string[] {
  return STRIPE_ALL_ENV_KEYS.filter((key) => !process.env[key]?.length)
}

/** True when secret, webhook secret, and all five price IDs are set. */
export function isBillingFullyConfigured(): boolean {
  return missingStripeEnvVars().length === 0
}

/** True when at least one Stripe billing env var is present. */
export function isAnyStripeEnvSet(): boolean {
  return STRIPE_ALL_ENV_KEYS.some((key) => Boolean(process.env[key]?.length))
}

/**
 * Production: BILLING_REQUIRED=true (or unset with full config expected on revenue
 * deploys) fails boot when Stripe is incomplete. Partial config always fails loud.
 */
export function validateStripeBillingEnv(): void {
  const anySet = isAnyStripeEnvSet()
  const missing = missingStripeEnvVars()
  const billingRequired =
    process.env.BILLING_REQUIRED === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.BILLING_REQUIRED !== 'false')

  if (anySet && missing.length > 0) {
    throw new Error(
      `[env] Stripe is partially configured. Missing: ${missing.join(', ')}. ` +
        'Set all of STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_BUILDER_PRICE_ID, ' +
        'STRIPE_TEAM_PRICE_ID, STRIPE_CREDIT_PACK_10_ID, STRIPE_CREDIT_PACK_25_ID, and ' +
        'STRIPE_CREDIT_PACK_50_ID, or clear them all.'
    )
  }

  if (billingRequired && missing.length > 0) {
    throw new Error(
      `[env] Billing is required in this environment but Stripe is not fully configured. ` +
        `Missing: ${missing.join(', ')}. Set BILLING_REQUIRED=false only for non-revenue deploys.`
    )
  }
}
