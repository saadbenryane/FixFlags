import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const EM_DASH = '\u2014'
const SCAN_ROOTS = ['app', 'components', 'lib']
const EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mdc'])
const ALLOWLIST = new Set<string>()

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      files.push(...collectFiles(full))
      continue
    }

    const ext = entry.name.slice(entry.name.lastIndexOf('.'))
    if (EXTENSIONS.has(ext)) {
      files.push(full)
    }
  }

  return files
}

describe('no em dash in source', () => {
  for (const root of SCAN_ROOTS) {
    const absRoot = join(process.cwd(), root)
    try {
      statSync(absRoot)
    } catch {
      continue
    }

    for (const file of collectFiles(absRoot)) {
      const rel = relative(process.cwd(), file)
      if (ALLOWLIST.has(rel)) continue

      it(`${rel} has no em dash (U+2014)`, () => {
        const content = readFileSync(file, 'utf8')
        const lines = content.split('\n')
        const hits: string[] = []

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(EM_DASH)) {
            hits.push(`L${i + 1}: ${lines[i].trim().slice(0, 120)}`)
          }
        }

        assert.equal(hits.length, 0, `Em dash found in ${rel}:\n${hits.join('\n')}`)
      })
    }
  }
})
