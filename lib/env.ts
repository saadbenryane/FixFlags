import { z } from 'zod'
import { validateAuthEnv } from '@/lib/auth/env'
import { validateStripeBillingEnv } from '@/lib/billing/config'
import { logger } from '@/lib/logger'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_GA_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, 'NEXT_PUBLIC_GA_ID must be a GA4 Measurement ID (e.g. G-XXXXXXXXXX)')
    .optional()
    .or(z.literal('')),
  PAGESPEED_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_BUILDER_PRICE_ID: z.string().optional(),
  STRIPE_TEAM_PRICE_ID: z.string().optional(),
  STRIPE_CREDIT_PACK_10_ID: z.string().optional(),
  STRIPE_CREDIT_PACK_25_ID: z.string().optional(),
  STRIPE_CREDIT_PACK_50_ID: z.string().optional(),
  STRIPE_API_VERSION: z.string().default('2025-02-24.acacia'),
  BILLING_REQUIRED: z.enum(['true', 'false']).optional(),
  DEV_SIMULATE_BILLING: z.enum(['true', 'false']).optional(),
  FIXFLAGS_ALLOW_DEGRADED_LOCAL: z.enum(['true', 'false']).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  ADMIN_USER_IDS: z.string().optional().transform(s => s ? s.split(',').map(x => x.trim()).filter(Boolean) : []),
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('false').transform(s => s === 'true'),
  SUPPORT_TENANT_SLUG: z.string().optional(),
  SAMPLE_AUDIT_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SAMPLE_AUDIT_URL: z.string().url().optional().or(z.literal('')),
  JUDGE_PROVIDER_CHAIN: z.string().default('openai,anthropic').transform(s => s.split(',').map(x => x.trim()).filter(Boolean)),
  OPENAI_JUDGE_MODEL: z.string().optional(),
  ANTHROPIC_JUDGE_MODEL: z.string().optional(),
  OPENAI_JUDGE_MAX_TOKENS: z.string().optional(),
  // Phase-1 triage (cheap teaser pass). Falls back to the judge provider chain
  // models when unset; small max_tokens keeps the anonymous scan cheap.
  TRIAGE_MODEL: z.string().optional(),
  TRIAGE_MAX_TOKENS: z.string().optional(),
  JUDGE_TIMEOUT_MS: z.string().optional(),
  OPENAI_JUDGE_IMAGE_DETAIL: z.enum(['low', 'high', 'auto']).optional(),
  CRITICAL_PATH_CONCURRENCY: z.string().optional(),
  AUDIT_WORKER_CONCURRENCY: z.string().optional(),
  // Run the audit worker in-process with the web server (default). Set to
  // 'false' on the web service when running dedicated worker services.
  INLINE_WORKER: z.enum(['true', 'false']).optional(),
  // Ad-platform conversion tracking (Workstream D). All optional; each feature
  // is gated on presence, mirroring NEXT_PUBLIC_GA_ID.
  NEXT_PUBLIC_GOOGLE_ADS_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_CAPI_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null
let _envError: Error | null = null

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${formatted}`)
  }
  return result.data
}

try {
  _env = parseEnv()
} catch (e) {
  _envError = e instanceof Error ? e : new Error(String(e))
}

export function getEnv(): Env {
  if (_envError) throw _envError
  if (!_env) {
    _env = parseEnv()
  }
  return _env
}

const R2_STORAGE_VARS = [
  'R2_BUCKET_NAME',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_URL',
] as const

function missingStorageVars(): string[] {
  return R2_STORAGE_VARS.filter((k) => !process.env[k])
}

const PRODUCTION_FEATURE_VARS = [
  'PAGESPEED_API_KEY',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'ADMIN_NOTIFICATION_EMAIL',
] as const

export function missingProductionLaunchVars(): string[] {
  const missing = PRODUCTION_FEATURE_VARS.filter((key) => !process.env[key]) as string[]
  missing.push(...missingStorageVars())
  if (!isAiProviderConfigured()) missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY')
  return missing
}

/** Whether production screenshot storage (R2) is fully configured. */
export function isProdStorageConfigured(): boolean {
  return missingStorageVars().length === 0
}

/** Whether at least one LLM provider key is set for triage and prescription. */
export function isAiProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
}

export function isExplicitLocalDegradedMode(): boolean {
  if (process.env.FIXFLAGS_ALLOW_DEGRADED_LOCAL !== 'true') return false
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  if (!configuredUrl) return false
  try {
    const hostname = new URL(configuredUrl).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function validateWorkerEnv(): void {
  const required = ['DATABASE_URL', 'REDIS_URL'] as const
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    // Fatal: the worker cannot process a single job without the database and
    // queue. There is nothing to degrade to.
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
  const localDegraded = isExplicitLocalDegradedMode()
  if (!isAiProviderConfigured()) {
    const message =
      '[env] No OPENAI_API_KEY or ANTHROPIC_API_KEY set. Triage and prescription ' +
      'are disabled; audits will complete with deterministic checks only.'
    if (process.env.NODE_ENV === 'production' && !localDegraded) {
      throw new Error(message)
    } else {
      logger.warn(message)
    }
  }
  if (!process.env.PAGESPEED_API_KEY) {
    const message =
      '[env] No PAGESPEED_API_KEY set. PageSpeed calls use IP-based quota and ' +
      'will likely hit rate limits (429), causing Experience flags to be thinner ' +
      'and rubric scores to be penalized. Set PAGESPEED_API_KEY for reliable results.'
    if (process.env.NODE_ENV === 'production' && !localDegraded) {
      throw new Error(message)
    } else {
      logger.warn(message)
    }
  }
  if (process.env.NODE_ENV === 'production' && !localDegraded) {
    if (!isProdStorageConfigured()) {
      throw new Error(
        '[env] R2 screenshot storage is NOT configured in production ' +
          `(missing: ${missingStorageVars().join(', ')}).`
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

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  getEnv()
  validateWorkerEnv()
  if (isExplicitLocalDegradedMode()) {
    logger.warn('[env] Explicit localhost degraded mode enabled; launch readiness remains unavailable.')
    return
  }
  validateAuthEnv()
  const missing = missingProductionLaunchVars()
  if (missing.length > 0) {
    throw new Error(
      `[env] Production launch configuration is incomplete. Missing: ${missing.join(', ')}.`
    )
  }
  validateStripeBillingEnv()
}

export function getRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production')
  }
  return 'redis://localhost:6379'
}
