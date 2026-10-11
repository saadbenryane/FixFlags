import { describe, expect, it } from 'vitest'
import { monitoringHistoryMetadata, siteTrendChecks, type MonitoringHistoryEntry } from '../monitoring-history'

const run = { source: 'WEB', verificationTarget: null, selections: [{ outcome: { name: 'Reach checkout' } }], assessments: [{ state: 'CLEAR' }] }
const base = { status: 'COMPLETED', flagCount: 0, executionSpec: { scope: 'SITE' } }

describe('monitoring history scope and evidence', () => {
  it('labels manual and scheduled Site analyses without inventing a Site-wide Clear result', () => {
    expect(monitoringHistoryMetadata({ ...base, runRequests: [{ ...run, selections: [] }] })).toMatchObject({ scope: 'SITE', trigger: 'MANUAL', result: null })
    expect(monitoringHistoryMetadata({ ...base, runRequests: [{ ...run, source: 'WATCH', selections: [] }] })).toMatchObject({ scope: 'SITE', trigger: 'SCHEDULED' })
  })

  it('labels post-fix checks by target and requires comparable recovery proof', () => {
    const input = { ...base, executionSpec: { scope: 'OUTCOMES' }, runRequests: [{ ...run, verificationTarget: { kind: 'OUTCOME', attemptId: 'attempt-1' } }] }
    expect(monitoringHistoryMetadata(input)).toMatchObject({ scope: 'OUTCOMES', afterFix: true, targetLabel: 'Reach checkout', result: 'COULD_NOT_VERIFY' })
    expect(monitoringHistoryMetadata({ ...input, verificationAttempts: [{ id: 'attempt-1', outcome: 'IMPROVED', comparable: false }] }).result).toBe('COULD_NOT_VERIFY')
    expect(monitoringHistoryMetadata({ ...input, verificationAttempts: [{ id: 'another-attempt', outcome: 'IMPROVED', comparable: true }] }).result).toBe('COULD_NOT_VERIFY')
    expect(monitoringHistoryMetadata({ ...input, verificationAttempts: [{ id: 'attempt-1', outcome: 'IMPROVED', comparable: true }] }).result).toBe('CLEAR')
    expect(monitoringHistoryMetadata({ ...input, flagCount: 1, verificationAttempts: [{ id: 'attempt-1', outcome: 'IMPROVED', comparable: true }] }).result).toBe('FLAG')
    expect(monitoringHistoryMetadata({ ...input, status: 'FAILED', verificationAttempts: [{ id: 'attempt-1', outcome: 'IMPROVED', comparable: true }] }).result).toBe('COULD_NOT_VERIFY')
  })

  it('labels the checked page without retaining URL query data', () => {
    expect(monitoringHistoryMetadata({ ...base, executionSpec: { scope: 'DIAGNOSTIC', verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: 'https://example.com/cart?private=value' } } })).toMatchObject({ scope: 'DIAGNOSTIC', targetLabel: '/cart', afterFix: true, result: 'COULD_NOT_VERIFY' })
  })

  it('requires evidence for every selected Outcome before showing Clear', () => {
    const input = { ...base, executionSpec: { scope: 'OUTCOMES' }, runRequests: [run] }
    expect(monitoringHistoryMetadata(input).result).toBe('CLEAR')
    expect(monitoringHistoryMetadata({ ...input, runRequests: [{ ...run, assessments: [] }] }).result).toBe('COULD_NOT_VERIFY')
    expect(monitoringHistoryMetadata({ ...input, runRequests: [{ ...run, assessments: [{ state: 'COULD_NOT_VERIFY' }] }] }).result).toBe('COULD_NOT_VERIFY')
  })

  it('keeps targeted, unknown and failed checks out of the Site-wide trend', () => {
    const entry = { checkedAt: '2026-10-11T09:00:00Z', flagCount: 0, status: 'COMPLETED' as const }
    const entries: MonitoringHistoryEntry[] = [
      { ...entry, id: 'site', scope: 'SITE' }, { ...entry, id: 'outcome', scope: 'OUTCOMES' },
      { ...entry, id: 'page', scope: 'DIAGNOSTIC' }, { ...entry, id: 'unknown', scope: 'UNKNOWN' },
      { ...entry, id: 'failed', scope: 'SITE', status: 'FAILED' }, { ...entry, id: 'legacy' },
    ]
    expect(siteTrendChecks(entries).map(item => item.id)).toEqual(['site', 'legacy'])
  })
})
