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
  if (status >= 500) return contract.file.includes('/health/') || contract.file.endsWith('/health/route.ts')
  if (contract.boundary === 'public') return status >= 200 && status < 500
  if (contract.boundary === 'webhook') return status === 400 || status === 401
  if (contract.boundary === 'mcp') {
    if (method === 'DELETE' && status === 200) return true
    return status === 400 || status === 401 || status === 406
  }
  if (contract.file === 'app/api/reports/[id]/share-links/route.ts' && status === 400) return true
  if (contract.file.includes('/api/integrations/')) return status === 307 || status === 401 || status === 403 || status === 404
  return status === 401 || status === 403 || status === 404
}

export async function runRouteBoundarySmoke(baseUrl, headers = {}) {
  const contracts = collectRouteContracts()
  const failures = []
  for (const contract of contracts) {
    for (const method of contract.methods) {
      const response = await fetch(`${baseUrl}${concreteRoute(contract.file)}`, {
        method,
        headers: {
          ...headers,
          ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
        },
        body: method === 'GET' ? undefined : '{}',
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      })
      if (!boundaryStatusAllowed(contract, response.status, method)) {
        failures.push(`${method} ${concreteRoute(contract.file)} returned ${response.status}`)
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
  console.log(`PASS route boundary smoke (${count} routes)`)
}
