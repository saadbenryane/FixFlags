import { z } from 'zod'
import { validateAuthEnv } from '@/lib/auth/env'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_GA_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, 'NEXT_PUBLIC_GA_ID must be a GA4 Measurement ID (e.g. G-XXXXXXXXXX)')
    .optional(),
  PAGESPEED_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  ADMIN_USER_IDS: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false']).optional(),
  SUPPORT_TENANT_SLUG: z.string().optional(),
  SAMPLE_AUDIT_URL: z.string().url().optional(),
  NEXT_PUBLIC_SAMPLE_AUDIT_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${formatted}`)
  }
  return result.data
}

/** Validated env, call after dotenv/config in worker, or rely on Next.js env loading in app. */
export function getEnv(): Env {
  if (!_env) _env = parseEnv()
  return _env
}

/** Validate only the vars required for audit pipeline (worker + queue). */
export function validateAuditEnv(): void {
  const required = ['DATABASE_URL', 'REDIS_URL'] as const
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing required env var: OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }
  if (process.env.NODE_ENV === 'production') {
    const r2Required = [
      'R2_BUCKET_NAME',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_PUBLIC_URL',
    ] as const
    const missingR2 = r2Required.filter((k) => !process.env[k])
    if (missingR2.length > 0) {
      // R2 is optional for boot: the app and auth come up fine without it, but
      // audits cannot persist screenshots until all R2 vars are set. Warn loudly
      // instead of crashing so the site can run while storage is being enabled.
      console.warn(
        `[env] R2 storage not configured (missing: ${missingR2.join(', ')}). ` +
          'Audits will fail at the screenshot step until R2 is set.'
      )
    }
  } else {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
    if (!appUrl) {
      throw new Error(
        'Missing NEXT_PUBLIC_APP_URL (or BETTER_AUTH_URL), required for local screenshot URLs'
      )
    }
  }
}

/** Validate production app env at startup. */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  getEnv()
  validateAuditEnv()
  validateAuthEnv()
  const required = [
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'NEXT_PUBLIC_APP_URL',
    'CRON_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'ADMIN_NOTIFICATION_EMAIL',
    'SAMPLE_AUDIT_URL',
  ] as const
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`)
  }
  // Billing (Stripe) is optional: when STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
  // are unset, checkout, the customer portal, and webhooks are disabled, but the
  // rest of the app boots and audits run normally. Set both to enable paid plans.
  if (!!process.env.STRIPE_SECRET_KEY !== !!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'Stripe is partially configured: set BOTH STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither.'
    )
  }
}

/** Redis URL with dev fallback only in development. */
export function getRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production')
  }
  return 'redis://localhost:6379'
}
