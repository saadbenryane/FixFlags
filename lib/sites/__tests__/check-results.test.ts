import { describe, expect, it } from 'vitest'
import { projectCheckResults } from '@/lib/sites/check-results'

const receipt = { id: 'r1', targetKey: 'module:metadata', status: 'COMPLETED',
  pageUrl: 'https://example.com', updatedAt: new Date('2026-10-10T12:00:00Z'), detail: {} }

describe('customer check results', () => {
  it('never invents assertion passes from completed modules or absent Flags', () => {
    expect(projectCheckResults('audit-1', [receipt])).toMatchObject([{ kind: 'execution', status: 'completed' }])
    expect(projectCheckResults('audit-1', [receipt]).some(result => result.status === 'passed')).toBe(false)
  })
  it('projects recorded assertions and drops malformed or private payloads', () => {
    const results = projectCheckResults('audit-1', [{ ...receipt, detail: { secret: 'private', assertions: [
      { key: 'title-presence', name: 'Title exists', expected: 'Title exists', observed: 'Present', passed: true },
      { key: 'description-presence', name: 'Description exists', expected: 'Description exists', observed: 'Absent', passed: false },
      { key: 'invalid', passed: true },
    ] } }])
    expect(results.map(result => result.status)).toEqual(['passed', 'findings', 'completed'])
    expect(JSON.stringify(results)).not.toContain('private')
  })
  it('keeps execution failure, not applicable, findings, and historical evidence distinct', () => {
    expect(projectCheckResults('audit-1', [{ ...receipt, status: 'FAILED' }])[0].status).toBe('failed')
    expect(projectCheckResults('audit-1', [{ ...receipt, status: 'NOT_APPLICABLE' }])[0].status).toBe('not_applicable')
    expect(projectCheckResults('audit-1', [{ ...receipt, detail: { passed: false } }], true)[0]).toMatchObject({ status: 'findings', historical: true, auditId: 'audit-1' })
  })
})
