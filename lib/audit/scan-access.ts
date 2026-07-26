import { z } from 'zod'
import type { BrowserContextOptions } from 'playwright'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'

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

export const scanAccessInputSchema = z.object({
  httpBasic: httpBasicSchema.optional(),
  cookies: z.array(cookieSchema).max(20).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  /** User note for Studio handoff (never sent to target site). */
  label: z.string().max(200).optional(),
})

export type ScanAccessConfig = z.infer<typeof scanAccessInputSchema>

const PREVIEW_TUNNEL_SUFFIXES = [
  '.ngrok.io',
  '.ngrok-free.app',
  '.ngrok.app',
  '.trycloudflare.com',
  '.loca.lt',
  '.preview.app',
  '.up.railway.app',
  '.railway.app',
] as const

export function isKnownPreviewTunnelHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return PREVIEW_TUNNEL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

export function parseScanAccessInput(raw: unknown): ScanAccessConfig | null {
  const parsed = scanAccessInputSchema.safeParse(raw)
  if (!parsed.success) return null
  const config = parsed.data
  const hasAuth =
    Boolean(config.httpBasic) ||
    Boolean(config.cookies?.length) ||
    Boolean(config.headers && Object.keys(config.headers).length > 0)
  return hasAuth ? config : null
}

export function encryptScanAccess(config: ScanAccessConfig): string {
  return encryptSecret(JSON.stringify(config))
}

export function decryptScanAccess(payload: string | null | undefined): ScanAccessConfig | null {
  if (!payload) return null
  try {
    const raw = JSON.parse(decryptSecret(payload)) as unknown
    return parseScanAccessInput(raw)
  } catch {
    return null
  }
}

export function scanAccessToFetchHeaders(
  config: ScanAccessConfig | null | undefined
): Record<string, string> {
  if (!config) return {}
  const headers: Record<string, string> = { ...(config.headers ?? {}) }
  if (config.httpBasic) {
    const token = Buffer.from(
      `${config.httpBasic.username}:${config.httpBasic.password}`,
      'utf8'
    ).toString('base64')
    headers.Authorization = `Basic ${token}`
  }
  return headers
}

export function scanAccessToPlaywrightContext(
  config: ScanAccessConfig | null | undefined
): Pick<BrowserContextOptions, 'httpCredentials' | 'extraHTTPHeaders'> {
  if (!config) return {}
  const extraHTTPHeaders = config.headers ? { ...config.headers } : undefined
  const httpCredentials = config.httpBasic
    ? { username: config.httpBasic.username, password: config.httpBasic.password }
    : undefined
  return { httpCredentials, extraHTTPHeaders }
}

export async function applyScanAccessCookies(
  context: { addCookies: (cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    url?: string
  }>) => Promise<void> },
  targetUrl: string,
  config: ScanAccessConfig | null | undefined
): Promise<void> {
  if (!config?.cookies?.length) return
  const origin = new URL(targetUrl)
  const cookies = config.cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? origin.hostname,
    path: cookie.path ?? '/',
    url: cookie.domain ? undefined : targetUrl,
  }))
  await context.addCookies(cookies)
}

export function redactScanAccessForClient(config: ScanAccessConfig): {
  hasHttpBasic: boolean
  cookieCount: number
  headerKeys: string[]
  label: string | null
} {
  return {
    hasHttpBasic: Boolean(config.httpBasic),
    cookieCount: config.cookies?.length ?? 0,
    headerKeys: Object.keys(config.headers ?? {}),
    label: config.label ?? null,
  }
}
