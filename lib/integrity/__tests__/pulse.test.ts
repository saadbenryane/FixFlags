import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('integrity pulse and Improve isolation', () => {
  it('does not import Improve from alerts', () => {
    const source = readFileSync(join(process.cwd(), 'lib/integrity/alerts.ts'), 'utf8')
    expect(source).not.toMatch(/improve/i)
  })

  it('enqueues a walk only from pulse failures in the pulse module', () => {
    const source = readFileSync(join(process.cwd(), 'lib/integrity/pulse.ts'), 'utf8')
    expect(source).toMatch(/enqueueIntegrityProbe/)
    expect(source).toMatch(/not_found/)
    expect(source).not.toMatch(/health: 'GREEN'/)
  })
})
