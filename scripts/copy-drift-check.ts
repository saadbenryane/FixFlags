/**
 * Exit 1 if banned customer phrases appear in marketing/help/docs surfaces.
 * Allowlist: terminology.ts (defines bans), paths containing __tests__ or .test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BANNED_CUSTOMER_PHRASES } from '../lib/marketing/copy/terminology'

const ROOT = join(import.meta.dirname, '..')

const SCAN_DIRS = [
  'lib/marketing',
  'components/marketing',
  'components/pricing',
  'components/dashboard',
  'app/(marketing)',
  'app/(app)',
  'lib/help',
  'content/docs',
] as const

const EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.json'])

function shouldSkip(path: string): boolean {
  if (path.includes('terminology.ts')) return true
  if (path.includes('__tests__')) return true
  if (/\.test\.(ts|tsx|mjs)$/.test(path)) return true
  return false
}

function collectFiles(dir: string, out: string[] = []): string[] {
  const abs = join(ROOT, dir)
  if (!statSync(abs).isDirectory()) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, entry.name)
    const rel = relative(ROOT, child)
    if (entry.isDirectory()) {
      collectFiles(join(dir, entry.name), out)
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      if (!shouldSkip(rel)) out.push(child)
    }
  }
  return out
}

const violations: Array<{ file: string; line: number; text: string; pattern: string }> = []

for (const dir of SCAN_DIRS) {
  for (const file of collectFiles(dir)) {
    const rel = relative(ROOT, file)
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/internal:/i.test(line) || /\/\/ internal\b/i.test(line)) continue
      for (const pattern of BANNED_CUSTOMER_PHRASES) {
        if (pattern.test(line)) {
          violations.push({
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

if (violations.length > 0) {
  console.error('Banned customer phrases found:')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} (${v.pattern}) ${v.text}`)
  }
  process.exit(1)
}

console.log('copy-drift-check: OK')
