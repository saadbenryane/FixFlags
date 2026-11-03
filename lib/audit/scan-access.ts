import type { BrowserContextOptions } from 'playwright'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import { parseScanAccessInput, type ScanAccessInput } from './scan-access-input'
export { parseScanAccessInput, scanAccessInputSchema } from './scan-access-input'

export type ScanAccessConfig = ScanAccessInput & { /** Server-bound credential origin, never accepted from client input. */ origin?: string }

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

export function encryptScanAccess(config: ScanAccessConfig): string {
  return encryptSecret(JSON.stringify(config))
}

export function decryptScanAccess(payload: string | null | undefined): ScanAccessConfig | null {
  if (!payload) return null
  try {
    const raw = JSON.parse(decryptSecret(payload)) as unknown
    if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 2) {
      return 'kind' in raw && raw.kind === 'scan-access-grant' && 'config' in raw ? parseScanAccessInput(raw.config) : null
    }
    return parseScanAccessInput(raw)
  } catch {
    return null
  }
}

export function scanAccessToFetchHeaders(
  config: ScanAccessConfig | null | undefined,
  targetUrl: string,
): Record<string, string> {
  if (!config || config.origin && new URL(config.origin).origin !== new URL(targetUrl).origin) return {}
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
  config: ScanAccessConfig | null | undefined,
  targetUrl: string,
): Pick<BrowserContextOptions, 'httpCredentials'> {
  if (!config) return {}
  const httpCredentials = config.httpBasic
    ? { username: config.httpBasic.username, password: config.httpBasic.password, origin: new URL(config.origin ?? targetUrl).origin }
    : undefined
  return { httpCredentials }
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
  const origin = new URL(config.origin ?? targetUrl)
  const cookies = config.cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? origin.hostname,
    path: cookie.path ?? '/',
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
