import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deadEndFix,
  pageHasNoNextStepEvidence,
  pathTookTooManyStepsEvidence,
} from '@/lib/audit/journey/run-template'

describe('customer walk evidence', () => {
  it('describes a page with no next step without internal walk notes', () => {
    const evidence = pageHasNoNextStepEvidence()
    expect(evidence).toBe('No link on this page continues to another page on the same site.')
    expect(evidence.toLowerCase()).not.toMatch(/same-origin|journey|navigation target/)
  })

  it('describes a long path without calling it a journey', () => {
    const evidence = pathTookTooManyStepsEvidence(8)
    expect(evidence).toBe('This path took 8 steps without a clear ending.')
    expect(evidence.toLowerCase()).not.toContain('journey')
  })

  it('tells the customer how to add the missing next step', () => {
    const fix = [
      deadEndFix('pricing-evaluation'),
      deadEndFix('signup'),
      deadEndFix('contact-support'),
      deadEndFix('first-visit'),
    ].join('\n')
    expect(fix.toLowerCase()).not.toMatch(/same-origin|crawlable|journey/)
    expect(deadEndFix('pricing-evaluation')).toContain('visible link to pricing or plans')
  })

  it('uses those sentences on the walk that stores the Flag', () => {
    const source = readFileSync(resolve(__dirname, '../run-template.ts'), 'utf8')
    expect(source).toContain('evidence: pageHasNoNextStepEvidence()')
    expect(source).toContain('evidence: pathTookTooManyStepsEvidence(maxSteps)')
    expect(source).not.toMatch(/evidence:.*abandonedReason/)
    expect(source).not.toContain('Journey reached')
  })
})
