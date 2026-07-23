import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildTriageSystemPrompt, buildPrescriptionSystemPrompt } from '@/lib/prompts/system-prompt'

describe('system-prompt triage contract', () => {
  it('asks triage for evidence and whyItMatters without fix prompts', () => {
    const system = buildTriageSystemPrompt()
    assert.match(system, /evidence/i)
    assert.match(system, /whyItMatters/i)
    assert.match(system, /Do NOT write fixes/i)
  })

  it('keeps prescription focused on fixes after triage value is visible', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /PRESCRIPTION/i)
    assert.match(system, /flag titles, evidence, and why it matters/i)
  })
})
