import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

const BANNED = [/in queue/i, /#\d+ in queue/i, /Checking your site/i]

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
      walk(path, acc)
    } else if (/\.(tsx|ts)$/.test(entry)) {
      acc.push(path)
    }
  }
  return acc
}

describe('audit progress copy', () => {
  it('uses product-review terminology for in-progress labels', () => {
    assert.match(AUDIT_PROGRESS.inProgress, /Reviewing/i)
    assert.match(AUDIT_PROGRESS.submitLoading, /Reviewing/i)
  })

  it('does not expose queue-position phrasing in audit UI components', () => {
    const root = join(process.cwd(), 'components', 'audit')
    const files = walk(root)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of BANNED) {
        assert.doesNotMatch(text, pattern, `${file} contains banned queue copy`)
      }
    }
  })
})
