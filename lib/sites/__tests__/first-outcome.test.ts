import { describe, expect, it } from 'vitest'
import { firstOutcomePrompt, homeBoardLead, walkFinishedFromCoverage } from '@/lib/sites/first-outcome'

describe('first site outcome prompt', () => {
  it('asks to watch the page only after a finished walk with no Outcome', () => {
    expect(walkFinishedFromCoverage('COMPLETED', { flowScan: true })).toBe(true)
    expect(walkFinishedFromCoverage('COMPLETED', { flowScan: false })).toBe(false)
    expect(walkFinishedFromCoverage('QUEUED', { flowScan: true })).toBe(false)

    const prompt = firstOutcomePrompt({
      checking: false,
      walkFinished: true,
      customerOutcomeCount: 0,
    })
    expect(prompt?.title).toBe('No Outcome yet')
    expect(prompt?.action).toBe('Confirm this page')
    expect(prompt?.body).toContain('Confirm this page if it should keep responding')
    expect(prompt?.body.toLowerCase()).not.toContain('watch')
    expect(prompt?.body).not.toMatch(/checkout|signup/i)
  })

  it('does not say FixFlags is watching unless Watch is on', () => {
    const waiting = homeBoardLead({
      checking: false,
      hasOutcomePrompt: false,
      flagCount: 4,
      healthy: false,
      coverageSummary: 'Checked once',
      watchCovered: false,
    })
    expect(waiting).toBe('The Flags that need you.')
    expect(waiting.toLowerCase()).not.toContain('watching')
    expect(homeBoardLead({
      checking: false,
      hasOutcomePrompt: true,
      flagCount: 4,
      healthy: false,
      coverageSummary: 'Checked once',
      watchCovered: false,
    }).toLowerCase()).not.toContain('watching')
    expect(homeBoardLead({
      checking: false,
      hasOutcomePrompt: false,
      flagCount: 4,
      healthy: false,
      coverageSummary: 'Checked once',
      watchCovered: true,
    })).toContain('FixFlags is watching')
  })

  it('stays quiet while checking, before a walk, or after an Outcome exists', () => {
    expect(firstOutcomePrompt({
      checking: true,
      walkFinished: true,
      customerOutcomeCount: 0,
    })).toBeNull()
    expect(firstOutcomePrompt({
      checking: false,
      walkFinished: false,
      customerOutcomeCount: 0,
    })).toBeNull()
    expect(firstOutcomePrompt({
      checking: false,
      walkFinished: true,
      customerOutcomeCount: 1,
    })).toBeNull()
  })
})
