import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
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

/** Validated env — call after dotenv/config in worker, or rely on Next.js env loading in app. */
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
}

/** Redis URL with dev fallback only in development. */
export function getRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production')
  }
  return 'redis://localhost:6379'
}
