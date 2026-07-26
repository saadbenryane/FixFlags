import { describe, expect, it } from 'vitest'
import { reconcileLaunchChecklist } from '@/lib/audit/validate-triage-output'
import type { DeterministicFlag } from '@/lib/audit/flag-types'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

const checklist: TriageOutput['launchChecklist'] = [
  { id: 'https', label: 'HTTPS', passed: false },
  { id: 'social-preview', label: 'Social preview', passed: false },
  { id: 'mobile-cta', label: 'Mobile CTA', passed: false },
  { id: 'console-errors', label: 'Console errors', passed: false },
  { id: 'privacy-contact', label: 'Privacy and contact', passed: true },
]

function flag(checkId: string): DeterministicFlag {
  return {
    checkId,
    rubric: 'REACH',
    severity: 'POLISH',
    problem: checkId,
    evidence: checkId,
    fix: checkId,
    confidence: 1,
    source: 'DETERMINISTIC',
  }
}

describe('reconcileLaunchChecklist', () => {
  it('uses deterministic pass/fail truth instead of AI checklist guesses', () => {
    const reconciled = reconcileLaunchChecklist(checklist, [
      flag('no-privacy-policy'),
    ])
    const passed = Object.fromEntries(reconciled.map((item) => [item.id, item.passed]))

    expect(passed).toEqual({
      https: true,
      'social-preview': true,
      'mobile-cta': true,
      'console-errors': true,
      'privacy-contact': false,
    })
  })
})
