import { describe, expect, it } from 'vitest'
import { buildCoverageFacts, evidencedAreasFromCoverage, keyboardScopeComplete } from '../coverage'

const url = 'https://example.com/'
const axe = { targetKey: 'module:accessibility', status: 'COMPLETED', pageUrl: url,
  detail: { kind: 'site-module-check', version: 1, module: 'accessibility', pageUrl: url, applicable: true, passed: true,
    assertions: [{ key: 'automated-accessibility', name: 'Axe', expected: 'No violations', observed: 'No violations', passed: true }] } }
const task = { targetKey: 'task:p0:keyboard-evidence', status: 'RUNNING', workKind: 'keyboard', pageUrl: url }
const receipt = { targetKey: 'module:keyboard', status: 'COMPLETED', pageUrl: url,
  detail: { kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: url, applicable: true, passed: true, complete: true,
    assertions: ['focus-styles', 'keyboard-exit', 'tab-sequence'].map(key => ({ key, name: key, expected: 'Expected', observed: 'Observed', passed: true })) } }

describe('keyboard coverage on the accessibility card', () => {
  it('does not show axe success as category clearance while planned keyboard evidence is missing or partial', () => {
    expect(evidencedAreasFromCoverage({}, [], [axe, task]).has('accessibility')).toBe(false)
    expect(evidencedAreasFromCoverage({}, [], [axe, task, { ...receipt, detail: { ...receipt.detail, complete: false } }]).has('accessibility')).toBe(false)
  })
  it('requires the actual keyboard scope for every admitted page', () => {
    expect(evidencedAreasFromCoverage({}, [], [axe, task, receipt]).has('accessibility')).toBe(true)
    expect(keyboardScopeComplete([task, receipt, { ...task, pageUrl: 'https://example.com/other' }])).toBe(false)
  })
  it('preserves historical axe scope without pretending keyboard tasks existed', () => {
    expect(evidencedAreasFromCoverage({}, [], [axe]).has('accessibility')).toBe(true)
  })
  it('retains a recorded focus failure alongside a passing focus observation', () => {
    const mixed = { ...receipt, detail: { ...receipt.detail, assertions: [...receipt.detail.assertions,
      { ...receipt.detail.assertions[0], passed: false }] } }
    expect(keyboardScopeComplete([task, mixed])).toBe(true)
    expect(evidencedAreasFromCoverage({}, [], [axe, task, mixed]).has('accessibility')).toBe(false)
  })
  it('accepts a completed keyboard-only scope without borrowing an automated pass', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    const current = { ...receipt, detail: { ...receipt.detail, execution: { auditId: 'audit', taskId: 'keyboard',
      source: 'keyboard', checkVersion: 1, collectedAt: now.toISOString() } } }
    const facts = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, flags: [],
      verifierExecutions: [current], pageScope: { auditId: 'audit', pages: [url], search: false, securityTransport: false,
        accessibility: { keyboard: true, automated: false } } })
    expect(facts.find(fact => fact.area === 'accessibility')).toMatchObject({ state: 'healthy', evidenced: true })
  })
})
