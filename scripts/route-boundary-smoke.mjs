#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectRouteContracts } from './route-contract-registry.mjs'

export function concreteRoute(file) {
  return `/${file}`
    .replace(/^\/app/, '')
    .replace(/\/route\.ts$/, '')
    .replace(/\[\.\.\.all\]/g, 'missing')
    .replace(/\[url\]/g, encodeURIComponent('https://example.com'))
    .replace(/\[[^/]+\]/g, 'missing')
}

export function boundaryStatusAllowed(contract, status, method = 'GET') {
  const expected = routeBoundaryProbe(contract, method).status
  if (expected !== undefined) return status === expected
  if (status >= 500) return contract.file.includes('/health/') || contract.file.endsWith('/health/route.ts')
  if (contract.boundary === 'parked') return status === 404 || (method === 'POST' && status === 409)
  if (contract.boundary === 'public') return status >= 200 && status < 500
  if (contract.boundary === 'webhook') return status === 400 || status === 401
  if (contract.boundary === 'api-key') return status === 401
  if (contract.file.includes('/api/integrations/')) return status === 307 || status === 401 || status === 403 || status === 404
  return status === 401 || status === 403 || status === 404
}

/** Method-specific negative requests must never borrow release credentials. */
export function routeBoundaryProbe(contract, method) {
  const file = contract.file
  if (file === 'app/api/cli/auth/device/route.ts') return { method: 'OPTIONS', status: 204, allow: 'POST' }
  if (file === 'app/api/cli/auth/token/route.ts') return { method, status: 400, json: { code: 'INVALID_REQUEST' } }
  if (file === 'app/api/cli/release/route.ts') return { method, status: 200, release: true }
  if (file === 'app/api/oauth/authorize/route.ts' || file === 'app/api/oauth/token/route.ts')
    return { method, status: 400, json: { error: 'invalid_request' } }
  if (file === 'app/api/oauth/register/route.ts') return { method, status: 400, json: { error: 'invalid_client_metadata' } }
  if (file === 'app/api/oauth/revoke/route.ts') return { method, status: 200, empty: true }
  if (file === 'app/api/flags/[id]/feedback/route.ts') return { method, status: 400, json: { code: 'INVALID_FEEDBACK' } }
  if (file === 'app/api/shopify/session/route.ts') return { method, status: 409, json: { code: 'INTEGRATION_COMING_SOON' } }
  if (file === 'app/api/sites/connections/google/callback/route.ts')
    return { method, status: 307, redirect: '/sign-in', next: '/dashboard' }
  if (file === 'app/api/mcp/route.ts') return { method, status: 401, mcp: true }
  if (file === 'app/api/webhooks/railway/route.ts') return { method, status: 401,
    body: { type: 'deployment.completed', deployment: { id: 'anonymous-boundary-probe', status: 'SUCCESS', url: 'https://example.com/' } } }
  return { method }
}

export async function boundaryResponseAllowed(contract, response, method, baseUrl) {
  const probe = routeBoundaryProbe(contract, method)
  if (!boundaryStatusAllowed(contract, response.status, method)) return false
  if (probe.allow && !response.headers.get('allow')?.split(',').map(value => value.trim()).includes(probe.allow)) return false
  if (probe.redirect) {
    const location = response.headers.get('location')
    if (!location) return false
    const target = new URL(location, baseUrl)
    if (target.origin !== new URL(baseUrl).origin || target.pathname !== probe.redirect || target.searchParams.get('next') !== probe.next) return false
  }
  if (probe.empty) return (await response.text()) === ''
  if (probe.json || probe.release || probe.mcp) {
    const body = await response.json().catch(() => null)
    if (probe.json && !Object.entries(probe.json).every(([key, value]) => body?.[key] === value)) return false
    if (probe.release && (body?.packageName !== 'fixflags' || typeof body?.version !== 'string' || typeof body?.available !== 'boolean')) return false
    if (probe.mcp && (body?.error?.data?.code !== 'MISSING_API_KEY' || !response.headers.get('www-authenticate')?.startsWith('Bearer '))) return false
  }
  return true
}

export async function runRouteBoundarySmoke(baseUrl) {
  const contracts = collectRouteContracts()
  const failures = []
  for (const contract of contracts) {
    for (const method of contract.methods) {
      const probe = routeBoundaryProbe(contract, method)
      const response = await fetch(`${baseUrl}${concreteRoute(contract.file)}`, {
        method: probe.method,
        headers: {
          ...(['GET', 'OPTIONS'].includes(probe.method) ? {} : { 'content-type': 'application/json' }),
        },
        body: ['GET', 'OPTIONS'].includes(probe.method) ? undefined : JSON.stringify(probe.body ?? {}),
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      })
      try {
        if (!await boundaryResponseAllowed(contract, response, method, baseUrl)) {
          failures.push(`${method} ${concreteRoute(contract.file)} returned ${response.status} with an unexpected boundary response`)
        }
      } finally {
        if (!response.bodyUsed) await response.body?.cancel()
      }
    }
  }
  if (failures.length > 0) throw new Error(`Route boundary smoke failed:\n${failures.join('\n')}`)
  return contracts.length
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const baseUrl = process.env.ROUTE_SMOKE_URL?.replace(/\/$/, '')
  if (!baseUrl) throw new Error('ROUTE_SMOKE_URL is required')
  const count = await runRouteBoundarySmoke(baseUrl)
  console.log(`PASS anonymous route boundary smoke (${count} routes; CLI device issuance uses OPTIONS only)`)
}
