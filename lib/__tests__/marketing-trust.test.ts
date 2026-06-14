import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { containsSpeculation } from '@/lib/audit/sanitize-prompts'

const MARKETING_DIR = join(process.cwd(), 'lib/marketing')

function collectMarketingFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectMarketingFiles(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

describe('marketing trust — no speculative copy', () => {
  for (const file of collectMarketingFiles(MARKETING_DIR)) {
    const rel = file.replace(process.cwd() + '/', '')
    it(`${rel} has no speculation patterns`, () => {
      const content = readFileSync(file, 'utf8')
      const lines = content.split('\n')
      const violations: string[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (containsSpeculation(line)) {
          violations.push(`L${i + 1}: ${line.trim().slice(0, 120)}`)
        }
      }

      assert.equal(
        violations.length,
        0,
        `Speculative copy found in ${rel}:\n${violations.join('\n')}`
      )
    })
  }
})
