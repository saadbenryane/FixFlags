/**
 * Copy drift guard.
 *
 * Rule 1: a banned customer phrase never reaches a customer-facing surface.
 * Rule 2: a customer-facing surface renders its words from lib/marketing/copy.
 *         New hardcoded copy fails. The committed baseline records the copy
 *         that still needs extraction, so the debt can only shrink.
 *
 * Usage:
 *   npm run copy-drift-check             check the surfaces
 *   npm run copy-drift-check -- --update rewrite the baseline
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BANNED_CUSTOMER_PHRASES } from '../lib/marketing/copy/terminology'

const ROOT = join(import.meta.dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/copy-baseline.json')

/** Surfaces a customer reads. Operator consoles and UI primitives keep their
 * own vocabulary and are not customer copy. */
const CUSTOMER_SURFACES = [
  'app/(app)',
  'app/(auth)',
  'app/(docs)',
  'app/(marketing)',
  'app/compare',
  'app/demo',
  'app/new',
  'app/report',
  'app/share',
  'app/shopify',
  'app/sites',
  'components',
  'content',
  'lib/help',
  'lib/marketing',
  'lib/sites',
] as const

const EXCLUDED_PREFIXES = ['app/admin/', 'components/admin/', 'components/ui/'] as const

/** Component surfaces that render customer words. */
const COMPONENT_SURFACES = ['app', 'components'] as const

/** Props whose value a customer reads. */
const CUSTOMER_PROPS = new Set([
  'actionLabel',
  'alt',
  'aria-description',
  'aria-label',
  'body',
  'buttonLabel',
  'caption',
  'cta',
  'description',
  'emptyBody',
  'emptyText',
  'emptyTitle',
  'errorText',
  'heading',
  'helperText',
  'hint',
  'label',
  'menuLabel',
  'message',
  'note',
  'placeholder',
  'srLabel',
  'subheading',
  'subtitle',
  'tabLabel',
  'text',
  'title',
  'tooltip',
])

const EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.json'])

function excluded(relativePath: string): boolean {
  if (relativePath.includes('__tests__')) return true
  if (/\.test\.(ts|tsx|mjs)$/.test(relativePath)) return true
  if (relativePath.includes('lib/marketing/copy/terminology.ts')) return true
  return EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
}

function collectFiles(dir: string, out: string[] = []): string[] {
  const abs = join(ROOT, dir)
  if (!statSync(abs).isDirectory()) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, entry.name)
    const rel = relative(ROOT, child)
    if (entry.isDirectory()) collectFiles(join(dir, entry.name), out)
    else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      if (!excluded(rel)) out.push(child)
    }
  }
  return out
}

function collectComponents(dir: string, out: string[] = []): string[] {
  const abs = join(ROOT, dir)
  if (!statSync(abs).isDirectory()) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, entry.name)
    const rel = relative(ROOT, child)
    if (entry.isDirectory()) collectComponents(join(dir, entry.name), out)
    else if (entry.name.endsWith('.tsx') && !excluded(rel)) out.push(child)
  }
  return out
}

/** A phrase a customer reads: words a person would say, not code, a path, or a
 * class name. */
function readsAsCopy(value: string): boolean {
  const text = value.trim()
  if (!text || !/[a-z]/.test(text)) return false
  if (/^(https?:|\/|mailto:|#)/i.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return false
  return words.every((word) => /^[0-9A-Za-z][0-9A-Za-z'’-]*[.,:;!?)]?$/.test(word))
}

function hardcodedCopy(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const found = new Set<string>()
  const text = />([^<>{}]*[a-zA-Z][^<>{}]*)</g
  let match = text.exec(source)
  while (match) {
    if (readsAsCopy(match[1])) found.add(match[1].trim())
    match = text.exec(source)
  }
  const attribute = /\b([a-zA-Z][a-zA-Z-]*)=(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g
  match = attribute.exec(source)
  while (match) {
    if (CUSTOMER_PROPS.has(match[1])) {
      const value = (match[2] ?? match[3] ?? match[4] ?? '').trim()
      if (readsAsCopy(value)) found.add(value)
    }
    match = attribute.exec(source)
  }
  return [...found].sort()
}

const bannedViolations: Array<{ file: string; line: number; text: string; pattern: string }> = []

for (const dir of CUSTOMER_SURFACES) {
  for (const file of collectFiles(dir)) {
    const rel = relative(ROOT, file)
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/internal:/i.test(line) || /\/\/ internal\b/i.test(line)) continue
      for (const pattern of BANNED_CUSTOMER_PHRASES) {
        const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
        for (const match of line.matchAll(new RegExp(pattern.source, flags))) {
          const before = line.slice(0, match.index)
          const after = line.slice(match.index + match[0].length)
          // A path or an identifier is not a phrase a customer reads.
          if (/[/_-]$/.test(before)) continue
          if (/^[/_-]/.test(after)) continue
          bannedViolations.push({
            file: rel,
            line: i + 1,
            text: line.trim().slice(0, 120),
            pattern: String(pattern),
          })
        }
      }
    }
  }
}

const actual = new Map<string, string[]>()
for (const dir of COMPONENT_SURFACES) {
  for (const file of collectComponents(dir)) {
    const rel = relative(ROOT, file)
    const copy = hardcodedCopy(file)
    if (copy.length > 0) actual.set(rel, copy)
  }
}

type Baseline = Record<string, string[]>
let baseline: Baseline = {}
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
} catch {
  baseline = {}
}

if (process.argv.includes('--update')) {
  const updated: Baseline = {}
  for (const [file, copy] of [...actual.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    updated[file] = copy
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`)
  console.log(`copy-drift-check: baseline written (${Object.keys(updated).length} files)`)
  process.exit(0)
}

const failures: string[] = []

if (bannedViolations.length > 0) {
  console.error('Banned customer phrases found:')
  for (const violation of bannedViolations) {
    console.error(`  ${violation.file}:${violation.line} (${violation.pattern}) ${violation.text}`)
  }
  failures.push(`${bannedViolations.length} banned customer phrase(s)`)
}

const added: Array<{ file: string; text: string }> = []
for (const [file, copy] of actual) {
  const known = new Set(baseline[file] ?? [])
  for (const text of copy) {
    if (!known.has(text)) added.push({ file, text })
  }
}

if (added.length > 0) {
  console.error('Hardcoded customer copy found. Move these words into lib/marketing/copy:')
  for (const entry of added) console.error(`  ${entry.file}: ${entry.text}`)
  failures.push(`${added.length} hardcoded customer copy string(s)`)
}

const resolved: string[] = []
for (const [file, copy] of Object.entries(baseline)) {
  const current = new Set(actual.get(file) ?? [])
  for (const text of copy) {
    if (!current.has(text)) resolved.push(`${file}: ${text}`)
  }
}

if (resolved.length > 0) {
  console.log(`copy-drift-check: ${resolved.length} baseline string(s) no longer present. Refresh the baseline:`)
  for (const entry of resolved) console.log(`  ${entry}`)
  console.log('  npm run copy-drift-check -- --update')
}

if (failures.length > 0) {
  console.error(`copy-drift-check: FAILED (${failures.join(', ')})`)
  process.exit(1)
}

console.log('copy-drift-check: OK')
