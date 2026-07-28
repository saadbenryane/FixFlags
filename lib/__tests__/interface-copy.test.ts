import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'vitest'

const ROOTS = [
  join(process.cwd(), 'app'),
  join(process.cwd(), 'components'),
  join(process.cwd(), 'lib', 'marketing', 'copy'),
  join(process.cwd(), 'lib', 'help'),
]

const BANNED_PHRASES = [
  'Fix these before you share it',
  'See every fix FixFlags found',
  'High-impact Flags',
  'Every dimension of release readiness',
]

function collectInterfaceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'api') return []
      return collectInterfaceFiles(full)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')
      ? [full]
      : []
  })
}

describe('interface copy', () => {
  for (const file of ROOTS.flatMap(collectInterfaceFiles)) {
    const rel = relative(process.cwd(), file)

    it(`${rel} avoids retired and repeated copy`, () => {
      const content = readFileSync(file, 'utf8')
      const retired = BANNED_PHRASES.filter((phrase) => content.includes(phrase))
      const repeatedFix = content.match(/\bfix\s+fix\b/i)

      assert.deepEqual(retired, [], `Retired interface copy in ${rel}: ${retired.join(', ')}`)
      assert.equal(repeatedFix, null, `Repeated “fix fix” wording in ${rel}`)
    })
  }
})
