import { z } from 'zod'

const cookieSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.string().max(4096),
  domain: z.string().max(253).optional(),
  path: z.string().max(200).optional(),
})

const httpBasicSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().max(500),
})

/** Shared input contract, independent of encryption and browser execution. */
export const scanAccessInputSchema = z.object({
  httpBasic: httpBasicSchema.optional(),
  cookies: z.array(cookieSchema).max(20).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  /** User note for Studio handoff (never sent to target site). */
  label: z.string().max(200).optional(),
})

export type ScanAccessInput = z.infer<typeof scanAccessInputSchema>

export function parseScanAccessInput(raw: unknown): ScanAccessInput | null {
  const parsed = scanAccessInputSchema.safeParse(raw)
  if (!parsed.success) return null
  const config = parsed.data
  const hasAuth = Boolean(config.httpBasic) || Boolean(config.cookies?.length) ||
    Boolean(config.headers && Object.keys(config.headers).length > 0)
  return hasAuth ? config : null
}
