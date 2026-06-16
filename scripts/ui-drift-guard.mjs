#!/usr/bin/env node
/**
 * Flags design-system drift in app and product components:
 * - font-display outside marketing/pricing surfaces
 * - rounded-xl / rounded-lg on panel-like shells (border + bg/padding combos)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next', 'dist', 'marketing'])

const FONT_DISPLAY_ALLOW = [
  /^app\/\(marketing\)\//,
  /^app\/opengraph-image/,
  /^components\/marketing\//,
  /^components\/pricing\//,
  /^components\/brand\//,
]

const PANEL_RE =
  /className=(?:"[^"]*rounded-(xl|lg)[^"]*(?:border|bg-|shadow|p-\d)[^"]*"|'[^']*rounded-(xl|lg)[^']*(?:border|bg-|shadow|p-\d)[^']*')/

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (/\.tsx$/.test(name)) files.push(p)
  }
  return files
}

const violations = []

for (const dir of SCAN_DIRS) {
  const base = join(ROOT, dir)
  for (const file of walk(base)) {
    const rel = relative(ROOT, file)
    const content = readFileSync(file, 'utf8')

    if (content.includes('font-display') && !FONT_DISPLAY_ALLOW.some((re) => re.test(rel))) {
      violations.push(`${rel}: font-display outside marketing/pricing surfaces`)
    }

    if (PANEL_RE.test(content)) {
      violations.push(`${rel}: rounded-xl/lg panel shell (use Card/Surface + rounded-card)`)
    }
  }
}

if (violations.length) {
  console.error('UI drift guard failed:\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('UI drift guard passed.')
