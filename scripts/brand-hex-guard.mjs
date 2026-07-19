#!/usr/bin/env node
/**
 * Fails if raw hex colors appear outside allowed brand files.
 * Allowed: lib/design/tokens.css, lib/design/brand-spec.ts (hslToHex output only in spec)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const ALLOWED = new Set([
  'lib/design/tokens.css',
  'lib/design/brand-spec.ts',
  // The demo page is a simulated third-party site for the scanner to audit; it
  // deliberately uses its own off-brand palette, not FixFlags brand tokens.
  'app/demo/demo.css',
])

// Path prefixes exempt from the brand palette. The /demo route is an
// intentionally non-brand sample site (a noindex audit target styled to look
// like a generic third-party page), so its raw colors are deliberate. AI prompt
// files are instruction text, not UI: they legitimately quote example hex values
// (e.g. teaching the model to cite "the button is gray (#999)" as evidence), so
// a raw hex there is content, never a styling violation.
const ALLOWED_PREFIXES = ['app/demo/', 'lib/prompts/', 'lib/audit/capture/']
// lib/audit/capture/* composites evidence PNGs/GIFs for flags (not product UI).
// Hex there is for Sharp/SVG overlays on screenshots, not Tailwind tokens.

const SCAN_DIRS = ['app', 'components', 'lib']
const SKIP = new Set(['node_modules', '.next', 'dist'])

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (/\.(tsx?|css)$/.test(name)) files.push(p)
  }
  return files
}

const violations = []

for (const dir of SCAN_DIRS) {
  const base = join(ROOT, dir)
  for (const file of walk(base)) {
    const rel = relative(ROOT, file)
    if (ALLOWED.has(rel)) continue
    if (ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue
    const content = readFileSync(file, 'utf8')
    const matches = content.match(HEX_RE)
    if (matches?.length) {
      violations.push({ file: rel, count: matches.length, sample: matches[0] })
    }
  }
}

if (violations.length) {
  console.error('Brand hex guard failed — use tokens or brand-spec.ts:\n')
  for (const v of violations) {
    console.error(`  ${v.file} (${v.count} hex, e.g. ${v.sample})`)
  }
  process.exit(1)
}

console.log('Brand hex guard passed.')
