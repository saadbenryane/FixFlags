import { describe, expect, it } from 'vitest'
import { projectCheckResults } from '@/lib/sites/check-results'
import { UNCOLLECTED_CHECK_LIMITATION } from '@/lib/audit/checks/receipt'

const receipt = { id: 'r1', targetKey: 'module:metadata', status: 'COMPLETED',
  pageUrl: 'https://example.com', updatedAt: new Date('2026-10-10T12:00:00Z'), detail: {} }

describe('customer check results', () => {
  it('requires a completed Search execution bound to the recorded audit and page for a definite result', () => {
    const collectedAt = receipt.updatedAt.toISOString()
    const search = { ...receipt, targetKey: 'module:search-canonical', source: 'SEARCH', detail: {
      kind: 'search-checks', version: 1, auditId: 'audit-1', pageUrl: receipt.pageUrl, collectedAt, complete: true,
      observations: [{ id: 'target', checkId: 'search-canonical-target', checkVersion: 5, responsibility: 'canonical',
        name: 'Canonical target', disposition: 'passed', reason: 'Reachable target', expected: 'A reachable target',
        observed: 'HTTP 200', source: 'http', collectedAt, pageUrl: receipt.pageUrl, evidence: [],
        attention: { policy: 'search', version: 5, kind: 'observation', reason: 'Reachable target' }, limitation: '', guidance: '' }],
    } }
    expect(projectCheckResults('audit-1', [search])).toMatchObject([{ kind: 'assertion', status: 'passed', area: 'search' }])
    expect(projectCheckResults('audit-1', [{ ...search, status: 'RUNNING' }])).toEqual([])
    expect(projectCheckResults('audit-1', [{ ...search, status: 'FAILED' }]))
      .toMatchObject([{ kind: 'execution', status: 'failed', area: 'search', historical: false }])
    expect(projectCheckResults('audit-1', [{ ...search, status: 'NOT_APPLICABLE' }]))
      .toMatchObject([{ kind: 'execution', status: 'not_applicable', area: 'search' }])
    expect(projectCheckResults('another-audit', [search]))
      .toMatchObject([{ kind: 'execution', status: 'unknown', area: 'search' }])
    expect(projectCheckResults('audit-1', [{ ...search, pageUrl: 'https://example.com/other' }]))
      .toMatchObject([{ kind: 'execution', status: 'unknown', area: 'search' }])
    expect(projectCheckResults('audit-1', [{ ...search, targetKey: 'module:search-presentation' }]))
      .toMatchObject([{ kind: 'execution', name: 'Search presentation', status: 'unknown', area: 'search' }])
    const misplaced = { ...search.detail.observations[0], id: 'borrowed', checkId: 'title-missing', responsibility: 'presentation', name: 'Page title' }
    expect(projectCheckResults('audit-1', [{ ...search, detail: { ...search.detail, observations: [...search.detail.observations, misplaced] } }]))
      .toMatchObject([{ kind: 'assertion', name: 'Canonical target', status: 'passed' },
        { kind: 'execution', name: 'Canonical declarations and targets', status: 'unknown' }])
    expect(projectCheckResults('audit-1', [{ ...search, detail: { ...search.detail, observations: [] } }]))
      .toMatchObject([{ kind: 'execution', name: 'Canonical declarations and targets', status: 'unknown', area: 'search' }])
    expect(projectCheckResults('audit-1', [{ ...search, detail: { ...search.detail, complete: false } }]))
      .toMatchObject([{ kind: 'assertion', status: 'passed', area: 'search' }, { kind: 'execution', status: 'unknown', area: 'search' }])
    expect(projectCheckResults('audit-1', [{ ...search, targetKey: 'module:search-google-index', status: 'FAILED', detail: {
      ...search.detail, complete: false, observations: [...search.detail.observations, {
        ...search.detail.observations[0], id: 'provider-unavailable', checkId: 'search-google-index', responsibility: 'google',
        disposition: 'unknown', source: 'google-index', observed: 'Search Console could not be reached',
      }],
    } }])).toMatchObject([{ kind: 'assertion', status: 'unknown', observation: 'Search Console could not be reached' }])
  })

  it('retains unknown historical identities without inventing their assertion contract', () => {
    expect(projectCheckResults('audit-1', [{ ...receipt, targetKey: 'module:retired-check', detail: { passed: true } }]))
      .toMatchObject([{ name: 'retired-check', status: 'unknown', historical: true,
        evidenceReference: { auditId: 'audit-1', executionId: 'r1' } }])
  })
  it('never invents assertion passes from completed modules or absent Flags', () => {
    for (const detail of [null, {}, 'unreadable', { assertions: [] }]) {
      expect(projectCheckResults('audit-1', [{ ...receipt, detail }])).toMatchObject([{ kind: 'execution', status: 'unknown' }])
    }
    expect(projectCheckResults('audit-1', [{ ...receipt, detail: { passed: true } }]))
      .toMatchObject([{ kind: 'execution', status: 'completed' }])
  })
  it('keeps URL-derived transport assertions unknown without a recorded HTTP execution', () => {
    const detail = { kind: 'site-module-check', version: 1, module: 'security', pageUrl: receipt.pageUrl,
      applicable: true, passed: true, complete: true,
      assertions: [{ key: 'https', name: 'Page uses HTTPS', expected: 'HTTPS', observed: 'HTTPS URL', passed: true, complete: true }],
    }
    const security = { ...receipt, targetKey: 'module:security', detail }
    expect(projectCheckResults('audit-1', [security])).toMatchObject([
      { name: 'Page uses HTTPS', status: 'unknown' }, { kind: 'execution', status: 'unknown' },
    ])
    const observed = { ...detail, execution: { auditId: 'audit-1', taskId: 'task-1', checkVersion: 1,
      source: 'http', collectedAt: receipt.updatedAt.toISOString() } }
    expect(projectCheckResults('audit-1', [{ ...security, detail: observed }])).toMatchObject([
      { name: 'Page uses HTTPS', status: 'passed' }, { kind: 'execution', status: 'completed' },
    ])
  })
  it('qualifies a saved non-security assertion when the receipt records missing collection', () => {
    const detail = { kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: receipt.pageUrl,
      applicable: true, passed: false, complete: false, limitation: UNCOLLECTED_CHECK_LIMITATION,
      assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title', observed: 'Title absent', passed: false, complete: true }],
    }
    expect(projectCheckResults('audit-1', [{ ...receipt, detail }])).toMatchObject([
      { name: 'Page title', status: 'unknown' }, { kind: 'execution', status: 'unknown' },
    ])
  })

  it('withholds versioned module observations outside their recorded execution scope', () => {
    const detail = { kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: receipt.pageUrl,
      applicable: true, passed: true, limitation: 'Detail from the wrong execution',
      execution: { auditId: 'audit-1', taskId: 'task-1', checkVersion: 1, source: 'http', collectedAt: receipt.updatedAt.toISOString() },
      assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title', observed: 'A recorded title', passed: true }],
    }
    expect(projectCheckResults('audit-1', [{ ...receipt, detail }]).map(result => result.status)).toEqual(['passed', 'completed'])
    for (const misplaced of [
      { ...receipt, targetKey: 'module:seo', detail },
      { ...receipt, pageUrl: 'https://example.com/other', detail },
      { ...receipt, detail: { ...detail, execution: { ...detail.execution, auditId: 'another-audit' } } },
      { ...receipt, detail: { ...detail, version: 999 } },
    ]) {
      const results = projectCheckResults('audit-1', [misplaced])
      expect(results).toMatchObject([{ kind: 'execution', status: 'unknown', source: 'DETERMINISTIC' }])
      expect(results[0].limitation).not.toContain(detail.limitation)
    }
  })
  it('projects recorded assertions and drops malformed or private payloads', () => {
    const results = projectCheckResults('audit-1', [{ ...receipt, detail: { secret: 'private', assertions: [
      { key: 'title-presence', name: 'Title exists', expected: 'Title exists', observed: 'Present', passed: true },
      { key: 'description-presence', name: 'Description exists', expected: 'Description exists', observed: 'Absent', passed: false },
      { key: 'invalid', passed: true },
    ] } }])
    expect(results.map(result => result.status)).toEqual(['passed', 'findings', 'unknown'])
    expect(JSON.stringify(results)).not.toContain('private')
  })
  it('retains decisive legacy observations while reconciling their saved completion summary', () => {
    const assertion = { key: 'title-presence', name: 'Page title', expected: 'A title', observed: 'Title absent', passed: false }
    const project = (detail: unknown) => projectCheckResults('audit-1', [{ ...receipt, detail }]).map(result => result.status)
    expect(project({ passed: true, assertions: [assertion] })).toEqual(['findings', 'findings'])
    expect(project({ passed: true, assertions: [{ ...assertion, complete: false }] })).toEqual(['unknown', 'unknown'])
    expect(project({ passed: true, complete: false, assertions: [{ ...assertion, passed: true }] })).toEqual(['passed', 'unknown'])
    expect(project({ passed: true, applicable: false })).toEqual(['not_applicable'])
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
    expect(results.map(result => result.status)).toEqual(['observed', 'unknown', 'unknown'])
    expect(results[0].assertionKey).toBe('tracking-initiation')
  })

})
