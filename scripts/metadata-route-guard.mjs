#!/usr/bin/env node
/**
 * Verify indexable marketing routes use approved metadata helpers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const ROUTE_TO_PAGE = {
  '/': 'app/(marketing)/page.tsx',
  '/waitlist': 'app/(marketing)/waitlist/page.tsx',
  '/how-it-works': 'app/(marketing)/how-it-works/page.tsx',
  '/pricing': 'app/(marketing)/pricing/page.tsx',
  '/faq': 'app/(marketing)/faq/page.tsx',
  '/help': 'app/(marketing)/help/page.tsx',
  '/docs': 'app/(docs)/docs/page.tsx',
  '/docs/getting-started': 'app/(docs)/docs/[slug]/page.tsx',
  '/docs/reports': 'app/(docs)/docs/[slug]/page.tsx',
  '/docs/troubleshooting': 'app/(docs)/docs/[slug]/page.tsx',
  '/examples': 'app/(marketing)/examples/page.tsx',
  '/changelog': 'app/(marketing)/changelog/page.tsx',
  '/blog': 'app/(marketing)/blog/page.tsx',
  '/samples': 'app/(marketing)/samples/page.tsx',
  '/privacy': 'app/(marketing)/privacy/page.tsx',
  '/terms': 'app/(marketing)/terms/page.tsx',
  '/tools/meta-preview': 'app/(marketing)/tools/meta-preview/page.tsx',
  '/tools/placeholder-detector': 'app/(marketing)/tools/placeholder-detector/page.tsx',
  '/issues': 'app/(marketing)/issues/page.tsx',
  '/partners': 'app/(marketing)/partners/page.tsx',
  '/roast': 'app/(marketing)/roast/page.tsx',
}

const APPROVED_METADATA_HELPERS = [
  'buildPageMetadata',
  'buildDocsMetadata',
  'buildIndexableMetadata',
]

const routesSource = readFileSync(join(ROOT, 'lib/marketing/seo-routes.ts'), 'utf8')
const indexableBlock = routesSource.match(
  /export const INDEXABLE_ROUTES[^[]*\[([\s\S]*?)\] as const/
)
if (!indexableBlock) {
  console.error('metadata-route-guard failed: could not parse INDEXABLE_ROUTES')
  process.exit(1)
}
const indexablePaths = [...indexableBlock[1].matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1])

const errors = []

for (const path of indexablePaths) {
  const relativePath = ROUTE_TO_PAGE[path]
  if (!relativePath) {
    errors.push(`No page mapping for indexable route "${path}"`)
    continue
  }

  const absolutePath = join(ROOT, relativePath)
  if (!existsSync(absolutePath)) {
    errors.push(`Missing page file for "${path}": ${relativePath}`)
    continue
  }

  const source = readFileSync(absolutePath, 'utf8')
  const usesApprovedHelper = APPROVED_METADATA_HELPERS.some((helper) => source.includes(helper))
  if (!usesApprovedHelper) {
    errors.push(`${relativePath} (${path}) does not use an approved metadata helper`)
  }
}

if (errors.length) {
  console.error('metadata-route-guard failed:\n')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`metadata-route-guard passed (${indexablePaths.length} indexable routes).`)
