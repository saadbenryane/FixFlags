#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HTTP_METHOD = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) walk(absolute, files)
    else if (entry === 'route.ts') files.push(absolute)
  }
  return files
}

function boundaryFor(file) {
  if (file.includes('/admin/')) return 'admin'
  if (file.includes('/cron/') || file.includes('/email/welcome/')) return 'secret'
  if (file.includes('/webhooks/')) return 'webhook'
  if (
    file.includes('/health/') || file.endsWith('/health/route.ts') || file.includes('/badge/') ||
    file.includes('/share/') || file.includes('/screenshots/') || file.includes('/well-known/') ||
    file.includes('/auth/') || file.includes('/newsletter/') || file.includes('/tools/') ||
    file.includes('/v1/score/') || file.endsWith('/checks/route.ts')
  ) return 'public'
  return 'session'
}

function casesFor(boundary, methods, file) {
  const cases = new Set(['success', 'dependency-failure'])
  if (boundary !== 'public') cases.add('unauthenticated')
  if (boundary === 'session' || boundary === 'admin') cases.add('forbidden')
  if (methods.some((method) => method !== 'GET')) cases.add('invalid-input')
  if (file.includes('[')) cases.add('not-found')
  if (/checkout|credit-pack|portal|watch|repo-scans|retry/.test(file)) cases.add('plan-gated')
  if (/checkout|credit-pack|watch|retry|select|connect|feedback/.test(file)) cases.add('conflict')
  return [...cases]
}

export function collectRouteContracts(root = process.cwd()) {
  return walk(path.join(root, 'app/api')).sort().map((absolute) => {
    const file = path.relative(root, absolute)
    const source = readFileSync(absolute, 'utf8')
    const methods = [...source.matchAll(HTTP_METHOD)].map((match) => match[1] || match[2])
    const boundary = boundaryFor(file)
    return { file, methods: [...new Set(methods)], boundary, cases: casesFor(boundary, methods, file) }
  })
}

export function validateRouteContracts(contracts) {
  const errors = []
  for (const contract of contracts) {
    if (contract.methods.length === 0) errors.push(`${contract.file}: no exported HTTP method`)
    if (!contract.cases.includes('success')) errors.push(`${contract.file}: missing success case`)
    if (!contract.cases.includes('dependency-failure')) errors.push(`${contract.file}: missing dependency-failure case`)
    if (contract.boundary !== 'public' && !contract.cases.includes('unauthenticated')) {
      errors.push(`${contract.file}: protected boundary missing unauthenticated case`)
    }
  }
  return errors
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const contracts = collectRouteContracts()
  const errors = validateRouteContracts(contracts)
  if (errors.length > 0) {
    console.error('Route contract registry failed:\n')
    for (const error of errors) console.error(`  ${error}`)
    process.exitCode = 1
  } else {
    const counts = Object.fromEntries(
      [...new Set(contracts.map(({ boundary }) => boundary))].sort().map((boundary) => [boundary, contracts.filter((contract) => contract.boundary === boundary).length])
    )
    console.log(`Route contract registry passed (${contracts.length} routes: ${JSON.stringify(counts)}).`)
  }
}
