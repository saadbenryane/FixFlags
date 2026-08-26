#!/usr/bin/env node
/**
 * Guard help catalog completeness: updatedAt on every public article,
 * relatedDocs or in-body link on operational articles.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const catalogPath = join(ROOT, 'lib/help/catalog.ts')
const catalogSource = readFileSync(catalogPath, 'utf8')

const errors = []

if (!catalogSource.includes('export const HELP_ARTICLES')) {
  errors.push('HELP_ARTICLES export missing from lib/help/catalog.ts')
}

const publicSlugs = new Set()
for (const match of catalogSource.matchAll(/slug:\s*'([^']+)'[\s\S]*?categoryId:\s*'([^']+)'/g)) {
  const slug = match[1]
  const categoryId = match[2]
  if (categoryId !== 'mcp-and-editors') publicSlugs.add(slug)
}

const missingUpdatedAt = [...publicSlugs].filter(
  (slug) => !new RegExp(`slug:\\s*'${slug}'[\\s\\S]*?updatedAt:`).test(catalogSource),
)

if (missingUpdatedAt.length) {
  errors.push(`Help articles missing updatedAt: ${missingUpdatedAt.join(', ')}`)
}

const exemptFromRelatedDocs = new Set(['contact-us', 'delete-account'])
const missingRelatedDocs = [...publicSlugs].filter((slug) => {
  if (exemptFromRelatedDocs.has(slug)) return false
  const block = catalogSource.match(new RegExp(`slug:\\s*'${slug}'[\\s\\S]*?(?=slug:\\s*'|$)`))
  if (!block) return true
  return !block[0].includes('relatedDocs:') && !block[0].includes("type: 'link'")
})

if (missingRelatedDocs.length) {
  errors.push(`Help articles missing relatedDocs or link block: ${missingRelatedDocs.join(', ')}`)
}

if (errors.length) {
  console.error('help-catalog-guard failed:\n')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`help-catalog-guard passed (${publicSlugs.size} public articles).`)
