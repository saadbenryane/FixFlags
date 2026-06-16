#!/usr/bin/env node
/**
 * Ensures SEO route registry stays aligned with copy.ts and llms.txt coverage.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const copyPath = join(ROOT, 'lib/marketing/copy.ts')
const seoRoutesPath = join(ROOT, 'lib/marketing/seo-routes.ts')
const llmsRoutesPath = join(ROOT, 'lib/marketing/seo-routes.ts')

const copy = readFileSync(copyPath, 'utf8')
const seoRoutes = readFileSync(seoRoutesPath, 'utf8')
const llmsRoutes = readFileSync(llmsRoutesPath, 'utf8')

function extractSeoKeys(source) {
  const match = source.match(/export const SEO = \{([\s\S]*?)\} as const/)
  if (!match) throw new Error('Could not find SEO block in copy.ts')
  return [...match[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1])
}

function extractRouteKeys(source) {
  return [...source.matchAll(/seoKey:\s*'(\w+)'/g)].map((m) => m[1])
}

function extractLlmsPaths(source) {
  return [...source.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1])
}

const seoKeys = extractSeoKeys(copy)
const routeKeys = extractRouteKeys(seoRoutes)
const llmsPaths = extractLlmsPaths(llmsRoutes)

const errors = []

for (const key of routeKeys) {
  if (!seoKeys.includes(key)) {
    errors.push(`INDEXABLE_ROUTES references seoKey "${key}" missing from SEO in copy.ts`)
  }
}

for (const key of seoKeys) {
  if (!routeKeys.includes(key)) {
    errors.push(`SEO key "${key}" in copy.ts is missing from INDEXABLE_ROUTES`)
  }
}

const requiredLlmsPaths = ['/', '/samples', '/pricing', '/docs/mcp', '/faq', '/privacy', '/terms', '/examples']
for (const path of requiredLlmsPaths) {
  if (!llmsPaths.includes(path)) {
    errors.push(`LLMS_SECTIONS missing path "${path}"`)
  }
}

if (errors.length) {
  console.error('SEO guard failed:\n')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('SEO guard passed.')
