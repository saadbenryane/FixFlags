import { describe, expect, it } from 'vitest'
import { retryDecision, validateTaskGraph, readArtifact, serializeArtifact, taskInputSchema } from '../contracts'
import { registerTaskHandlers } from '../registry'
import { initialTaskPlan, availabilityOnly } from '../graph'
import { CHECK_REGISTRY } from '../../check-registry'

const input = { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' }
describe('durable bounded work contracts', () => {
  it('retries transient interruptions within both recovery windows, never customer failures', () => {
    const base = { now: 100_000, admittedAt: 0, attempts: 1, crash: false, random: 0.5 }
    expect(retryDecision({ ...base, retryable: true })).toEqual({ retry: true, until: 1_900_000, nextAt: 105_000 })
    expect(retryDecision({ ...base, retryable: false }).retry).toBe(false)
    expect(retryDecision({ ...base, retryable: true, firstFailureAt: 0, now: 1_800_000 }).retry).toBe(false)
    expect(retryDecision({ ...base, retryable: true, now: 3_600_000 }).retry).toBe(false)
  })
  it('limits repeated worker/parser crashes to three execution attempts and honors provider backoff', () => {
    expect(retryDecision({ now: 0, admittedAt: 0, attempts: 3, crash: true, retryable: true }).retry).toBe(false)
    expect(retryDecision({ now: 0, admittedAt: 0, attempts: 8, crash: false, retryable: true, retryAfterMs: 120_000 }).nextAt).toBe(120_000)
  })
  it('rejects missing dependencies, cycles, duplicate task identities, and unknown input fields', () => {
    const task = { kind: 'http' as const, key: 'a', scope: 'page', input, dependencies: [] as string[] }
    expect(() => validateTaskGraph([task, task])).toThrow('Duplicate')
    expect(() => validateTaskGraph([{ ...task, dependencies: ['b'] }])).toThrow('Missing')
    expect(() => validateTaskGraph([{ ...task, dependencies: ['a'] }])).toThrow('Cyclic')
    expect(() => taskInputSchema.parse({ ...input, password: 'not a secret reference' })).toThrow()
  })
  it('rejects absent evaluators, duplicate handlers, and protected tasks without reconciliation', () => {
    const handler = { kind: 'http' as const, replay: 'read_only' as const, timeoutMs: 1000,
      evaluate: async () => serializeArtifact('http', {}), validateResult: () => {} }
    expect(() => registerTaskHandlers([handler, handler])).toThrow('Invalid')
    expect(() => registerTaskHandlers([{ ...handler, replay: 'protected' }])).toThrow('reconciliation')
    expect(() => registerTaskHandlers([{ ...handler, evaluate: undefined as never }])).toThrow('Invalid')
    expect(() => readArtifact(serializeArtifact('http', {}), 'browser')).toThrow('ARTIFACT_KIND_MISMATCH')
  })
  it('makes public collection and bindings independent of browser, speed, Google, and explanation', () => {
    const graph = initialTaskPlan({ version: 1, targetUrl: input.pageUrl, environment: 'production', scope: 'SITE',
      checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, value]) => [id, value.version])),
      outcomes: [{ id: 'availability', kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
        bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', required: true, config: {} }] }], verificationTarget: null })
    const byKey = new Map(graph.map(task => [task.key, task]))
    expect(byKey.get('p0:http')!.dependencies).toEqual([])
    expect(byKey.get('p0:browser')!.dependencies).toEqual([])
    expect(byKey.get('p0:captures')!.dependencies).toEqual([])
    expect(byKey.get('p0:accessibility')!.dependencies).toEqual(['p0:browser'])
    expect(byKey.get('p0:metadata')!.dependencies).not.toContain('p0:captures')
    expect(byKey.get('p0:security-headers')!.dependencies).toEqual(['p0:http'])
    expect(byKey.get('p0:performance')!.dependencies).toEqual(['p0:pagespeed-desktop'])
    expect(byKey.get('p0:mobile')!.dependencies).toEqual(['p0:pagespeed-mobile'])
    expect(byKey.get('binding:availability:http')!.dependencies).toEqual([])
    expect(byKey.get('p0:search')!.dependencies).not.toContain('p0:pagespeed')
    expect(byKey.get('p0:search')!.dependencies).not.toContain('p0:google')
    expect(byKey.get('p0:search')!.dependencies).not.toContain('p0:captures')
    expect(byKey.get('robots')!.dependencies).toEqual([])
    expect(byKey.get('resources')!.dependencies).toEqual(['robots'])
    expect(byKey.get('p0:search-crawl')!.dependencies).toEqual(['p0:http', 'robots'])
    expect(byKey.get('p0:search-canonical')!.dependencies).toEqual(['p0:http', 'p0:browser'])
    expect(byKey.get('p0:search-structured-data')!.dependencies).toEqual(['p0:http', 'p0:browser'])
    expect(byKey.get('p0:google-index')!.dependencies).toEqual(['p0:search-indexing'])
    expect(byKey.get('p0:google-performance')!.dependencies).toEqual([])
    expect(byKey.get('p0:judge')!.dependencies).toContain('p0:captures')
    expect(byKey.get('p0:judge')!.dependencies).toContain('p0:security-headers')
  })
  it('isolates requested bindings and reserves availability without spawning a broad scan', () => {
    const spec = { version: 1 as const, targetUrl: input.pageUrl, environment: 'production', scope: 'OUTCOMES' as const,
      checks: {}, outcomes: [{ id: 'availability', kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
        bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY' as const, required: true, config: {} }] }], verificationTarget: null }
    const graph = initialTaskPlan(spec)
    expect(graph.map(task => task.kind)).toEqual(['bindings', 'finalize'])
    expect(availabilityOnly(spec)).toBe(true)
    expect(availabilityOnly({ ...spec, scope: 'SITE' })).toBe(false)
  })
  it('builds a diagnostic verifier from only its actual dependencies', () => {
    const spec = { version: 1 as const, targetUrl: input.pageUrl, environment: 'production', scope: 'DIAGNOSTIC' as const,
      checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, value]) => [id, value.version])), outcomes: [],
      verificationTarget: { kind: 'DIAGNOSTIC' as const, pageUrl: input.pageUrl, checkId: 'security-csp-missing', attemptId: 'attempt', parentAuditId: 'before' } }
    expect(initialTaskPlan(spec).map(task => task.kind)).toEqual(['check', 'http', 'finalize'])
    expect(initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'title-missing' } }).map(task => task.kind))
      .toEqual(['search', 'http', 'browser', 'finalize'])
    expect(() => initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'unknown-history' } })).toThrow('not registered')
  })
  it('admits Signup setup on the same ledger without unrelated collectors', () => {
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
      scope: 'FIXTURE_SETUP', fixtureSetup: { id: 'fixture', version: 3 }, checks: {}, outcomes: [], verificationTarget: null })
    expect(graph.map(task => task.kind)).toEqual(['fixture-setup', 'finalize'])
    expect(graph[0].input.fixtureId).toBe('fixture')
    expect(graph[1].dependencies).toEqual(['fixture-setup'])
    validateTaskGraph(graph)
  })

})
