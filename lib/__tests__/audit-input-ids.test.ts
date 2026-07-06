import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SCAN_ROOTS = ['app', 'components']
const ALLOWLISTED_BARE = new Set<string>()

interface AuditInputUsage {
  file: string
  line: number
  suffix: string
}

const AUDIT_INPUT_RE = /<AuditInput\s[^>]*\/?>/g
const ID_SUFFIX_RE = /idSuffix\s*=\s*["']([^"']+)["']/

describe('AuditInput IDs', () => {
  const usages: AuditInputUsage[] = []
  const bareUsages: AuditInputUsage[] = []

  for (const root of SCAN_ROOTS) {
    const absRoot = join(process.cwd(), root)
    try {
      statSync(absRoot)
    } catch {
      continue
    }
    collectFiles(absRoot, usages, bareUsages)
  }

  it('every AuditInput has a unique idSuffix', () => {
    const seen = new Map<string, AuditInputUsage[]>()
    for (const u of usages.filter((u) => u.suffix)) {
      const list = seen.get(u.suffix) ?? []
      list.push(u)
      seen.set(u.suffix, list)
    }
    const dupes = [...seen.entries()].filter(([, list]) => list.length > 1)
    if (dupes.length > 0) {
      const msg = dupes
        .map(
          ([suffix, list]) =>
            `  "${suffix}" used ${list.length}x:\n${list.map((u) => `    ${u.file}:${u.line}`).join('\n')}`
        )
        .join('\n')
      assert.fail(`Duplicate AuditInput idSuffix found:\n${msg}`)
    }
  })

  it('no bare (no idSuffix) AuditInput exists', () => {
    const unlisted = bareUsages.filter((u) => {
      const key = relative(process.cwd(), join(process.cwd(), u.file))
      return !ALLOWLISTED_BARE.has(key)
    })
    if (unlisted.length > 0) {
      const msg = unlisted
        .map((u) => `  ${u.file}:${u.line}`)
        .join('\n')
      assert.fail(`AuditInput without idSuffix at:\n${msg}`)
    }
  })
})

function collectFiles(
  dir: string,
  usages: AuditInputUsage[],
  bareUsages: AuditInputUsage[]
): void {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      collectFiles(full, usages, bareUsages)
      continue
    }
    if (!entry.name.endsWith('.tsx')) continue
    const content = readFileSync(full, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes('AuditInput')) continue
      const match = line.match(AUDIT_INPUT_RE)
      if (!match) continue
      const suffixMatch = line.match(ID_SUFFIX_RE)
      const suffix = suffixMatch?.[1] ?? ''
      const usage = {
        file: relative(process.cwd(), full),
        line: i + 1,
        suffix,
      }
      usages.push(usage)
      if (!suffix) bareUsages.push(usage)
    }
  }
}
