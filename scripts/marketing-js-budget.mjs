#!/usr/bin/env node
/**
 * Marketing JavaScript budget, measured from a production build.
 *
 * Usage: node scripts/marketing-js-budget.mjs [distDir]
 * The default matches scripts/next-build.mjs: NEXT_DIST_DIR, else .next-verify.
 *
 * Reads the homepage client-reference manifest and reports gzip sizes for the shared shell
 * (root and marketing layouts) and for code only the homepage loads. The limits ratchet:
 * lower them as the shell gets lighter, never raise them to make a change pass. The plan's
 * target is under 200 KB for the whole first view, which needs the shell work first.
 */
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import vm from 'node:vm'

export const BUDGET_KB = { shell: 170, homepage: 60 }

export function measure(distDir) {
  const manifestPath = path.join(distDir, 'server/app/(marketing)/page_client-reference-manifest.js')
  if (!existsSync(manifestPath)) throw new Error(`No homepage manifest at ${manifestPath}. Run a production build first.`)
  const sandbox = { self: {} }
  sandbox.globalThis = sandbox.self
  vm.runInNewContext(readFileSync(manifestPath, 'utf8'), sandbox)
  const manifest = sandbox.self.__RSC_MANIFEST['/(marketing)/page']
  const entries = manifest.entryJSFiles
  const files = suffix => entries[Object.keys(entries).find(key => key.endsWith(suffix))] ?? []
  const shell = new Set([...files('app/layout'), ...files('(marketing)/layout')])
  const homepage = files('(marketing)/page').filter(file => !shell.has(file))
  const kb = list => Math.round(list.reduce((total, file) => total + gzipSync(readFileSync(path.join(distDir, file))).length, 0) / 1024)
  return { shell: kb([...shell]), homepage: kb(homepage) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const distDir = process.argv[2] ?? process.env.NEXT_DIST_DIR ?? '.next-verify'
  const sizes = measure(distDir)
  const failures = Object.entries(BUDGET_KB).filter(([key, limit]) => sizes[key] > limit)
  for (const [key, limit] of Object.entries(BUDGET_KB)) console.log(`${key}: ${sizes[key]} KB gzip (budget ${limit} KB)`)
  if (failures.length > 0) {
    console.error(`Marketing JavaScript budget exceeded: ${failures.map(([key]) => key).join(', ')}`)
    process.exit(1)
  }
  console.log('Marketing JavaScript budget passed.')
}
