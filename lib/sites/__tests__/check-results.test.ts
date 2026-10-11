import { describe, expect, it } from 'vitest'
import { projectCheckResults } from '@/lib/sites/check-results'

const receipt = { id: 'r1', targetKey: 'module:metadata', status: 'COMPLETED',
  pageUrl: 'https://example.com', updatedAt: new Date('2026-10-10T12:00:00Z'), detail: {} }

describe('customer check results', () => {
  it('retains unknown historical identities without inventing their assertion contract', () => {
    expect(projectCheckResults('audit-1', [{ ...receipt, targetKey: 'module:retired-check', detail: { passed: true } }]))
      .toMatchObject([{ name: 'retired-check', status: 'unknown', historical: true,
        evidenceReference: { auditId: 'audit-1', executionId: 'r1' } }])
  })
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
  it('shows bounded keyboard evidence as incomplete while retaining an observed finding', () => {
    const results = projectCheckResults('audit-1', [{ ...receipt, targetKey: 'module:keyboard', detail: {
      kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: receipt.pageUrl,
      applicable: true, passed: false, complete: false, limitation: 'The Tab step limit was reached. Unvisited controls remain unknown.',
      assertions: [{ key: 'focus-styles', name: 'Focus styles', expected: 'Visible focus style', observed: 'Missing on Action', passed: false }],
    } }])
    expect(results.map(result => result.status)).toEqual(['findings', 'unknown'])
    expect(results[1].limitation).toContain('Unvisited controls')
    expect(results.some(result => result.status === 'passed')).toBe(false)
  })
  it('keeps partial popup observations visible with distinct identities and unknown outcomes', () => {
    const assertion = { key: 'focus-styles', name: 'Options: focus styles', expected: 'Visible focus style', observed: 'Observed', passed: true, complete: true }
    const results = projectCheckResults('audit-1', [{ ...receipt, targetKey: 'module:keyboard', detail: {
      kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: receipt.pageUrl, applicable: true, passed: false, complete: false,
      assertions: [{ ...assertion, context: 'menu:#one=>#popup' },
        { ...assertion, context: 'menu:#one=>#popup', passed: false, complete: false },
        { ...assertion, context: 'menu:#two=>#popup' }],
    } }])
    expect(results.map(result => result.status)).toEqual(['passed', 'unknown', 'passed', 'unknown'])
    expect(new Set(results.map(result => result.id)).size).toBe(results.length)
  })

  it('shows initiated Tracking requests as observations while delivery and provider recording remain unknown', () => {
    const results = projectCheckResults('audit-1', [{ ...receipt, targetKey: 'module:measurement', detail: {
      kind: 'site-module-check', version: 1, module: 'measurement', pageUrl: receipt.pageUrl, applicable: true, passed: true,
      assertions: [{ key: 'tracking-initiation', name: 'Attempt', expected: 'Request initiated', observed: 'Suppressed by FixFlags', passed: true, complete: true, disposition: 'observed' },
        { key: 'tracking-http-response', name: 'Destination', expected: 'Response', observed: 'Suppressed', passed: false, complete: false }],
    } }])
    expect(results.map(result => result.status)).toEqual(['observed', 'unknown', 'completed'])
    expect(results[0].assertionKey).toBe('tracking-initiation')
  })

})
