#!/usr/bin/env node
/**
 * Fails if raw hex colors appear outside allowed brand files.
 * Canonical palettes: lib/design/tokens.css and lib/design/brand-spec.ts.
 * Intentional third-party examples and generated artwork are exempt below.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const ALLOWED_PREFIXES = [
  'app/demo/',
  'lib/prompts/',
  'lib/audit/capture/',
  // Generated SVG badge and roast artwork uses non-CSS rendering values.
  'app/api/badge/',
  'app/api/tools/roast/',
]

const SCAN_DIRS = ['app', 'components', 'lib']
const SKIP = new Set(['node_modules', '.next', 'dist'])

const HEX_RE = /#[0-9a-fA-F]{3,8}\b(?!%)/g

export function brandColorViolations(file, source) {
  if (ALLOWED.has(file) || ALLOWED_PREFIXES.some(prefix => file.startsWith(prefix))) return []
  // Scanner test documents model third-party websites, not product styling.
  if (/^lib\/audit\/.*(?:\.test\.tsx?$|\/fixtures\/)/.test(file)) return []
  const stylingSource = source.replace(/\b(?:href|id)=(['"])[^'"]*\1/g, '')
    .replace(/\bselector\s*:\s*(['"])[^'"]*\1/g, '')
    .replace(/\b(?:querySelector|querySelectorAll|locator)\(\s*(['"])[^'"]*\1/g, '')
  return stylingSource.match(HEX_RE) ?? []
}

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

export function runBrandHexGuard(root = ROOT) {
  const violations = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(root, dir))) {
      const rel = relative(root, file)
      const matches = brandColorViolations(rel, readFileSync(file, 'utf8'))
      if (matches.length) violations.push({ file: rel, count: matches.length, sample: matches[0] })
    }
  }
  return violations
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = runBrandHexGuard()
  if (violations.length) {
    console.error('Brand hex guard failed. Use tokens or brand-spec.ts:')
    for (const v of violations) console.error(`  ${v.file} (${v.count} hex, e.g. ${v.sample})`)
    process.exitCode = 1
  } else console.log('Brand hex guard passed.')
}
