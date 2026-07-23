#!/usr/bin/env node
/**
 * Prevents next/image localPatterns allowlist regressions that blank live
 * brand and marketing assets (HTTP 400: "url parameter is not allowed").
 *
 * When images.localPatterns is set, Next.js only optimizes matching paths.
 * Required public prefixes used by next/image must remain listed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CONFIG_PATH = join(ROOT, 'next.config.ts')

/** Path prefixes that must appear in images.localPatterns when that list is set. */
const REQUIRED_LOCAL_PATTERNS = [
  '/api/screenshots/**',
  '/brand/**',
  '/marketing/**',
]

const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next', 'dist'])

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

function extractLocalPatternPathnames(configSource) {
  const block = configSource.match(/localPatterns\s*:\s*\[([\s\S]*?)\]/)
  if (!block) return null
  const pathnames = [...block[1].matchAll(/pathname\s*:\s*['"`]([^'"`]+)['"`]/g)].map(
    (m) => m[1],
  )
  return pathnames
}

/**
 * Collect static local src paths from next/image usages that are not unoptimized.
 * Dynamic srcs (variables) are skipped; those are covered by REQUIRED_LOCAL_PATTERNS.
 */
function findOptimizedStaticLocalSrcs() {
  const srcs = new Set()
  const imageImport = /from\s+['"]next\/image['"]/

  for (const dir of SCAN_DIRS) {
    const base = join(ROOT, dir)
    for (const file of walk(base)) {
      const content = readFileSync(file, 'utf8')
      if (!imageImport.test(content)) continue

      // Split on <Image ... /> / <Image ...></Image> opening tags roughly.
      const tags = content.match(/<Image\b[\s\S]*?(?:\/>|>)/g) ?? []
      for (const tag of tags) {
        if (/\bunoptimized\b/.test(tag)) continue
        const srcMatch = tag.match(/\bsrc=\{?['"`](\/[^'"`]+)['"`]\}?/)
        if (!srcMatch) continue
        const src = srcMatch[1]
        // Remote or data URLs are not localPatterns concerns.
        if (src.startsWith('http') || src.startsWith('data:')) continue
        srcs.add(src)
      }
    }
  }
  return [...srcs]
}

function pathnameMatches(pattern, pathname) {
  // Next localPatterns: * = one segment, ** = any depth.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE::')
    .replace(/\*/g, '[^/]+')
    .replace(/::DOUBLE::/g, '.*')
  return new RegExp(`^${escaped}$`).test(pathname)
}

const configSource = readFileSync(CONFIG_PATH, 'utf8')
const patterns = extractLocalPatternPathnames(configSource)
const violations = []

if (patterns === null) {
  // No allowlist: Next allows all local paths. That is safe for this regression.
} else {
  for (const required of REQUIRED_LOCAL_PATTERNS) {
    if (!patterns.includes(required)) {
      violations.push(
        `next.config.ts images.localPatterns missing required pathname '${required}'`,
      )
    }
  }

  for (const src of findOptimizedStaticLocalSrcs()) {
    const covered = patterns.some((pattern) => pathnameMatches(pattern, src))
    if (!covered) {
      violations.push(
        `next/image src '${src}' is optimized but not covered by images.localPatterns (add a pathname or set unoptimized)`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('image-local-patterns-guard failed:\n' + violations.map((v) => `  - ${v}`).join('\n'))
  process.exit(1)
}

console.log(
  patterns === null
    ? 'image-local-patterns-guard: ok (no localPatterns allowlist)'
    : `image-local-patterns-guard: ok (${patterns.length} patterns)`,
)
