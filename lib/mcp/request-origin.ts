import { hostHeaderValidationResponse, originValidationResponse, localhostAllowedHostnames } from '@modelcontextprotocol/server'
import { getAppUrl } from '@/lib/get-app-url'

/** The configured origin owns the allowlist. Request URLs can be normalized by
 * Next.js, and incoming Host headers cannot authorize themselves. */
export function validateMcpRequestOrigin(request: Request, appUrl = getAppUrl()): Response | undefined {
  const configured = new URL(appUrl)
  const loopback = localhostAllowedHostnames()
  const hosts = loopback.includes(configured.hostname) ? loopback : [configured.hostname]
  const rejected = hostHeaderValidationResponse(request, hosts) ?? originValidationResponse(request, hosts)
  if (rejected) return rejected
  const origin = request.headers.get('origin')
  if (!origin) return undefined
  const allowedOrigins = hosts.map(host => `${configured.protocol}//${host}${configured.port ? ':' + configured.port : ''}`)
  if (!allowedOrigins.includes(origin)) return Response.json({ jsonrpc: '2.0', id: null,
    error: { code: -32000, message: 'Invalid Origin' } }, { status: 403 })
  return undefined
}
