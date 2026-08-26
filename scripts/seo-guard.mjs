#!/usr/bin/env node
/**
 * Ensures SEO route registry stays aligned with the canonical SEO copy module
 * and llms.txt coverage.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const copyPath = join(ROOT, 'lib/marketing/copy/seo.ts')
const copyBarrelPath = join(ROOT, 'lib/marketing/copy.ts')
const routesPath = join(ROOT, 'lib/marketing/seo-routes.ts')

const copy = readFileSync(copyPath, 'utf8')
const copyBarrel = readFileSync(copyBarrelPath, 'utf8')
const routes = readFileSync(routesPath, 'utf8')

function extractSeoKeys(source) {
  const match = source.match(/export const SEO = \{([\s\S]*?)\} as const/)
  if (!match) throw new Error('Could not find SEO block in copy/seo.ts')
  return [...match[1].matchAll(/^[ \t]+(\w+):\s*\{/gm)].map((m) => m[1])
}

function extractRouteKeys(source) {
  return [...source.matchAll(/seoKey:\s*'(\w+)'/g)].map((m) => m[1])
}

function extractLlmsPaths(source) {
  return [...source.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1])
}

const seoKeys = extractSeoKeys(copy)
const routeKeys = extractRouteKeys(routes)
const llmsPaths = extractLlmsPaths(routes)

const errors = []

if (!copyBarrel.includes("export * from './copy/seo'")) {
  errors.push('lib/marketing/copy.ts does not re-export the canonical SEO copy module')
}

for (const key of routeKeys) {
  if (!seoKeys.includes(key)) {
    errors.push(`INDEXABLE_ROUTES references seoKey "${key}" missing from SEO in copy/seo.ts`)
  }
}

for (const key of seoKeys) {
  if (!routeKeys.includes(key)) {
    errors.push(`SEO key "${key}" in copy/seo.ts is missing from INDEXABLE_ROUTES`)
  }
}

const requiredLlmsPaths = ['/', '/how-it-works', '/samples', '/pricing', '/docs', '/docs/getting-started', '/docs/reports', '/docs/troubleshooting', '/faq', '/help', '/help/getting-started/first-check', '/help/billing-and-plans/free-vs-pro', '/help/checks-and-reports/why-check-failed', '/privacy', '/terms', '/examples', '/tools/meta-preview', '/tools/placeholder-detector']
for (const path of requiredLlmsPaths) {
  if (!llmsPaths.includes(path)) {
    errors.push(`LLMS_SECTIONS missing path "${path}"`)
  }
}

const catalogSource = readFileSync(join(ROOT, 'lib/help/catalog.ts'), 'utf8')
const helpArticlePaths = [...catalogSource.matchAll(/slug:\s*'([^']+)'[\s\S]*?categoryId:\s*'([^']+)'/g)].map(
  (match) => `/help/${match[2]}/${match[1]}`
)
const helpCategoryPaths = [...catalogSource.matchAll(/\{\s*\n\s*id:\s*'([^']+)'/g)].map(
  (match) => `/help/${match[1]}`
)

for (const llmsPath of llmsPaths) {
  if (!llmsPath.startsWith('/help/')) continue
  if (llmsPath === '/help') continue
  const exists =
    helpArticlePaths.includes(llmsPath) ||
    helpCategoryPaths.includes(llmsPath) ||
    llmsPath.endsWith('/contact-us')
  if (!exists && requiredLlmsPaths.includes(llmsPath)) {
    errors.push(`LLMS help path "${llmsPath}" not found in help catalog`)
  }
}

if (errors.length) {
  console.error('SEO guard failed:\n')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('SEO guard passed.')
