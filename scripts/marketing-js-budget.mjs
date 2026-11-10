#!/usr/bin/env node
/**
 * Marketing JavaScript budget, measured from a production build.
 *
 * Usage: node scripts/marketing-js-budget.mjs [distDir]
 * The default matches scripts/next-build.mjs: NEXT_DIST_DIR, else .next-verify.
 *
 * Reads the scripts each prerendered marketing page loads and reports gzip sizes for the shared
 * shell (scripts every compared marketing page loads, beyond Next.js's own runtime) and for code
 * only the homepage adds. This
 * measures what a visitor downloads, independent of Next.js manifest internals. The limits ratchet:
 * lower them as the shell gets lighter, never raise them to make a change pass. The plan's
 * target is under 200 KB for the whole first view, which needs the shell work first.
 */
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

/**
 * Shell was 170 KB under the earlier manifest measure, which Next.js 16.4 no longer supports
 * (`entryJSFiles` is gone). The HTML measure also counts the error boundaries, not-found page
 * and the (auth) layout that every marketing page loads: 189 KB on November 10, re-baselined
 * here as a new ruler, not raised for a change. Homepage code measures the same either way.
 * Next step to lower it: stop loading the (auth) layout on marketing pages.
 */
export const BUDGET_KB = { shell: 190, homepage: 60 }

/** Marketing pages compared with the homepage to find the shared shell. */
const COMPARED_PAGES = ['pricing', 'faq', 'security', 'integrations']

function pageScripts(distDir, page) {
  const htmlPath = path.join(distDir, 'server/app', `${page}.html`)
  if (!existsSync(htmlPath)) throw new Error(`No prerendered ${page} page at ${htmlPath}. Run a production build first.`)
  return new Set([...readFileSync(htmlPath, 'utf8').matchAll(/<script[^>]+src="\/_next\/([^"?]+)/g)].map(match => match[1]))
}

/** Next.js's own runtime and polyfills, which the shell budget has never counted. */
function frameworkFiles(distDir) {
  const manifest = JSON.parse(readFileSync(path.join(distDir, 'build-manifest.json'), 'utf8'))
  return new Set([...manifest.rootMainFiles, ...manifest.polyfillFiles])
}

export function measure(distDir) {
  const framework = frameworkFiles(distDir)
  const home = new Set([...pageScripts(distDir, 'index')].filter(file => !framework.has(file)))
  const others = COMPARED_PAGES.map(page => pageScripts(distDir, page))
  const shell = [...home].filter(file => others.every(scripts => scripts.has(file)))
  const homepage = [...home].filter(file => !shell.includes(file))
  const kb = list => Math.round(list.reduce((total, file) => total + gzipSync(readFileSync(path.join(distDir, file))).length, 0) / 1024)
  return { shell: kb(shell), homepage: kb(homepage) }
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
