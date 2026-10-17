import { queueForTask, priorityForTask, TASK_QUEUES } from '../queues'
import { describe, expect, it } from 'vitest'
import { retryDecision, validateTaskGraph, readArtifact, serializeArtifact, taskInputSchema } from '../contracts'
import { registerTaskHandlers } from '../registry'
import { initialTaskPlan, pageTaskPlan, availabilityOnly } from '../graph'
import { CHECK_REGISTRY } from '../../check-registry'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'
import { pageMetadataSchema } from '../snapshots'
import { parseMetadataFromHtml } from '../../metadata'

const input = { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' }
describe('durable bounded work contracts', () => {
  it('isolates independent services and prioritizes primary work inside each bounded resource', () => {
    expect(queueForTask('pagespeed', input)).toBe('pagespeed')
    expect(queueForTask('google', input)).toBe('google')
    expect(queueForTask('judge', input)).toBe('provider')
    expect(queueForTask('prescription', input)).toBe('provider')
    expect(TASK_QUEUES.provider.name).toBe('audit-task-provider')
    for (const kind of ['pagespeed', 'google', 'judge'] as const)
      expect(priorityForTask(kind, input)).toBeLessThan(priorityForTask(kind, { ...input, primary: false }))
    expect(priorityForTask('prescription', { ...input, primary: false })).toBeLessThan(priorityForTask('judge', { ...input, primary: false }))
  })

  it('isolates pricing navigation from the primary action and selects only its original scope for repair', () => {
    const spec = { version: 1 as const, engine: 'progressive-v1' as const, targetUrl: input.pageUrl, environment: 'production', scope: 'SITE' as const,
      checks: { 'flow-pricing-nav-broken': 1, 'flow-cta-dead-end': 1 }, outcomes: [] }
    const graph = pageTaskPlan({ ...input, role: 'primary' }, spec)
    const pricing = graph.find(task => task.input.module === 'pricing-navigation')!, primary = graph.find(task => task.key === 'p0:flow')!
    expect(pricing).toMatchObject({ kind: 'flow', dependencies: [] })
    expect(primary.dependencies).not.toContain(pricing.key)
    expect(pricing.dependencies).not.toContain(primary.key)
    expect(pageTaskPlan({ ...input, role: 'primary' }, { ...spec, checks: { 'overlay-blocks-nav': 1 } }).some(task => task.key === 'p0:pricing-navigation')).toBe(true)
    const repair = initialTaskPlan({ ...spec, scope: 'DIAGNOSTIC', checks: { 'flow-pricing-nav-broken': 1 },
      verificationScopes: [{ pageUrl: input.pageUrl, phases: ['public_action'] }],
      verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'flow-pricing-nav-broken', pageUrl: input.pageUrl, parentAuditId: 'source', attemptId: 'repair' } })
    expect(repair.map(task => task.key).sort()).toEqual(['finalize', 'p0:pricing-navigation'])
    validateTaskGraph(repair)
  })
  it('preserves bounded rendered-copy evidence across the persisted metadata contract', () => {
    const metadata = parseMetadataFromHtml('<h1 hidden>Retired promise</h1><h1>Useful service for teams</h1>', input.pageUrl)
    const renderedCopy = { version: 1 as const, pageUrl: input.pageUrl, pageText: 'Useful service for teams', h1s: ['Useful service for teams'], h2s: [], complete: true, textTruncated: false }
    const stored = pageMetadataSchema.parse({ ...metadata, renderedCopy })
    expect(stored.renderedCopy).toEqual(renderedCopy)
    expect(pageMetadataSchema.parse(metadata).renderedCopy).toBeUndefined()
    expect(pageMetadataSchema.parse({ ...metadata, renderedCopy: null }).renderedCopy).toBeNull()
    expect(pageMetadataSchema.safeParse({ ...metadata, renderedCopy: { ...renderedCopy, pageText: 'x'.repeat(8001) } }).success).toBe(false)
  })
  it('starts retained Site pages independently of entry-page discovery and preserves their admitted navigation URLs', () => {
    const monitoringPages = [input.pageUrl, 'https://example.com/pricing?mode=original#step']
    const spec = { version: 1 as const, engine: 'progressive-v1' as const, targetUrl: input.pageUrl, environment: 'production', scope: 'SITE' as const,
      reviewDepth: 2 as const, checks: { 'title-missing': 1 }, monitoringPages, outcomes: [], verificationTarget: null }
    const graph = initialTaskPlan(spec)
    expect(graph.filter(task => task.kind === 'browser').map(task => task.input.pageUrl)).toEqual(monitoringPages)
    expect(graph.filter(task => task.kind === 'browser').every(task => task.dependencies.length === 0)).toBe(true)
    expect(graph.find(task => task.kind === 'cross-page')!.dependencies).toContain('p1:search')
    expect(initialTaskPlan({ ...spec, reviewDepth: 1 }).filter(task => task.kind === 'browser')).toHaveLength(1)
    expect(() => executionSpecSchema.parse({ ...spec, scope: 'OUTCOMES' })).toThrow('monitoring page scope')
    validateTaskGraph(graph)
  })
  it('rechecks all original preview pages with only browser collection and the cross-page comparison', () => {
    const pages = [input.pageUrl, 'https://example.com/pricing', 'https://example.com/features']
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: pages[1], environment: 'production', scope: 'DIAGNOSTIC',
      checks: { 'corridor-og-title-drift': 1 }, outcomes: [], verificationScopes: pages.map(pageUrl => ({ pageUrl, phases: ['page_load'] })),
      verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'corridor-og-title-drift', pageUrl: pages[1], attemptId: 'attempt', parentAuditId: 'before' } })
    expect(graph.map(task => task.kind)).toEqual(['browser', 'browser', 'browser', 'cross-page', 'finalize'])
    expect(graph.find(task => task.kind === 'cross-page')!.dependencies).toEqual(['p0:browser', 'p1:browser', 'p2:browser'])
    validateTaskGraph(graph)
  })
  it('plans only the frozen overlay interaction workflow for diagnostic repair', () => {
    for (const phase of ['primary_action', 'pricing_navigation', 'form_validation', 'journey_signup_form']) {
      const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production', scope: 'DIAGNOSTIC',
        checks: { 'overlay-blocks-form': 1 }, outcomes: [], verificationScopes: [{ pageUrl: input.pageUrl, phases: ['page_load'], overlayPhases: [phase] }],
        verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'overlay-blocks-form', pageUrl: input.pageUrl, attemptId: 'attempt', parentAuditId: 'before' } })
      expect(graph.some(task => task.kind === 'overlays'), phase).toBe(false)
      expect(graph.some(task => task.kind === 'pagespeed' || task.kind === 'google'), phase).toBe(false)
      expect(graph.some(task => phase === 'journey_signup_form' ? task.kind === 'journeys' : task.kind === 'flow'), phase).toBe(true)
      validateTaskGraph(graph)
    }
  })
  it('admits independent overlay repair for every originally checked device without navigation work', () => {
    for (const checkId of ['overlay-blocks-nav', 'overlay-blocks-cta', 'overlay-blocks-form']) {
      const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
        scope: 'DIAGNOSTIC', checks: { [checkId]: 1 }, outcomes: [],
        verificationTarget: { kind: 'DIAGNOSTIC', checkId, pageUrl: input.pageUrl, attemptId: 'attempt', parentAuditId: 'before' } })
      expect(graph.map(task => task.kind)).toEqual(['overlays', 'overlays', 'finalize'])
      expect(graph.slice(0, 2).map(task => task.input.device)).toEqual(['desktop', 'mobile'])
      expect(graph.slice(0, 2).every(task => !task.dependencies.length)).toBe(true)
      validateTaskGraph(graph)
    }
  })
  it.each(['search', 'performance', 'conversion', 'security', 'tracking', 'accessibility'] as const)('plans only %s work and its required collectors for every frozen page', area => {
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'CATEGORY', targetUrl: input.pageUrl,
      environment: 'production', category: { area, sourceAuditId: 'full', pages: [input.pageUrl, 'https://example.com/second'] },
      checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).filter(([id, definition]) => definition.area === area || area === 'search' && id.startsWith('corridor-og-')).map(([id, definition]) => [id, definition.version])),
      outcomes: [], verificationTarget: null })
    const graph = initialTaskPlan(spec)
    validateTaskGraph(graph)
    expect(graph.filter(task => task.kind === 'browser').map(task => task.input.pageUrl)).toEqual(spec.category!.pages)
    expect(graph.some(task => ['captures', 'judge', 'discovery'].includes(task.kind))).toBe(false)
    if (area !== 'search') expect(graph.some(task => ['search', 'google', 'search-resources'].includes(task.kind))).toBe(false)
    expect(graph.some(task => task.kind === 'cross-page')).toBe(area === 'search' || area === 'conversion')
    if (area !== 'performance') {
      expect(graph.some(task => task.kind === 'slow-replay')).toBe(false)
      for (const collector of graph.filter(task => task.kind === 'pagespeed'))
        expect(graph.some(task => task.kind === 'check' && task.dependencies.includes(collector.key))).toBe(true)
    }
    if (area === 'tracking' || area === 'conversion') expect(graph.filter(task => task.kind === 'flow' && !task.input.module).map(task => task.input.pageUrl)).toEqual(spec.category!.pages)
    expect(graph.at(-1)?.kind).toBe('finalize')
  })
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
    expect(byKey.get('p0:motion')!.dependencies).toEqual(['p0:browser'])
    expect(byKey.get('p0:interaction')!.dependencies).toContain('p0:motion')
    expect(byKey.get('p0:metadata')!.dependencies).not.toContain('p0:motion')
    expect(byKey.get('p0:keyboard')!.dependencies).toEqual(['p0:keyboard-evidence'])
    expect(byKey.get('p0:keyboard-evidence')!.dependencies).toEqual([])
    expect(byKey.get('p0:metadata')!.dependencies).not.toContain('p0:captures')
    expect(byKey.get('p0:security-headers')!.dependencies).toEqual(['p0:http'])
    expect(byKey.get('p0:performance')!.dependencies).toEqual(['p0:pagespeed-desktop'])
    expect(byKey.get('p0:inp-mobile')!.dependencies).toEqual(['p0:pagespeed-mobile'])
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
  it('admits automatic account work only through its explicit snapshot', () => {
    const base = { version: 1 as const, targetUrl: input.pageUrl, environment: 'production', scope: 'SITE' as const,
      checks: {}, outcomes: [], verificationTarget: null }
    expect(initialTaskPlan(base).some(task => task.kind === 'automatic-accounts')).toBe(false)
    const graph = initialTaskPlan({ ...base, accountChecks: { revision: 1, mode: 'routine' } })
    expect(graph.find(task => task.kind === 'finalize')?.dependencies).toContain('automatic-accounts')
    expect(initialTaskPlan({ ...base, scope: 'ACCOUNT_CHECKS', accountChecks: { revision: 2, mode: 'cleanup' } }).map(task => task.kind))
      .toEqual(['automatic-accounts', 'finalize'])
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
    const inp = initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'inp-critical' } })
    expect(inp.map(task => task.key)).toEqual(['p0:inp-mobile', 'p0:pagespeed-mobile', 'finalize'])
    expect(initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'title-missing' } }).map(task => task.kind))
      .toEqual(['search', 'http', 'browser', 'finalize'])
    const titles = initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'title-missing' },
      verificationScopes: [{ pageUrl: input.pageUrl, phases: ['page_load'] }, { pageUrl: 'https://example.com/second', phases: ['page_load'] }] })
    expect(titles.filter(task => task.kind === 'search').map(task => task.input.pageUrl)).toEqual([input.pageUrl, 'https://example.com/second'])
    expect(titles.filter(task => task.kind === 'http')).toHaveLength(2)
    expect(titles.filter(task => task.kind === 'browser')).toHaveLength(2)
    expect(titles.some(task => ['captures', 'google', 'pagespeed', 'flow', 'discovery'].includes(task.kind))).toBe(false)
    const tracking = { ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'tracking-library-http-error' } }
    expect(initialTaskPlan(tracking).map(task => task.kind)).toEqual(['check', 'browser', 'finalize'])
    expect(initialTaskPlan({ ...tracking, verificationScopes: [{ pageUrl: input.pageUrl, phases: ['public_action'] }] }).map(task => task.kind)).toEqual(['check', 'browser', 'flow', 'finalize'])
    const multiPage = initialTaskPlan({ ...tracking, verificationScopes: [{ pageUrl: input.pageUrl, phases: ['page_load'] },
      { pageUrl: 'https://example.com/second', phases: ['public_action'] }] })
    expect(multiPage.filter(task => task.kind === 'browser').map(task => task.input.pageUrl)).toEqual([input.pageUrl, 'https://example.com/second'])
    expect(multiPage.find(task => task.kind === 'flow')?.input.pageUrl).toBe('https://example.com/second')
    expect(multiPage.some(task => ['captures', 'pagespeed', 'google', 'search'].includes(task.kind))).toBe(false)
    for (const checkId of ['checkout-link-dead', 'og-image-broken', 'broken-internal-links']) {
      const destinations = initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId },
        verificationScopes: [{ pageUrl: input.pageUrl, phases: ['page_load'] }, { pageUrl: 'https://example.com/second', phases: ['page_load'] }] })
      expect(destinations.filter(task => task.kind === 'browser').map(task => task.input.pageUrl)).toEqual([input.pageUrl, 'https://example.com/second'])
      expect(destinations.filter(task => task.kind === 'check')).toHaveLength(2)
      expect(destinations.some(task => ['captures', 'pagespeed', 'google', 'search', 'flow'].includes(task.kind))).toBe(false)
    }
    expect(() => initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'unknown-history' } })).toThrow('not registered')
    expect(initialTaskPlan({ ...spec, verificationTarget: { ...spec.verificationTarget, checkId: 'focus-visible-missing' } }).map(task => task.kind))
      .toEqual(['check', 'keyboard', 'finalize'])
  })
  it('admits Signup setup on the same ledger without unrelated collectors', () => {
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
      scope: 'FIXTURE_SETUP', fixtureSetup: { id: 'fixture', version: 3 }, checks: {}, outcomes: [], verificationTarget: null })
    expect(graph.map(task => task.kind)).toEqual(['fixture-setup', 'finalize'])
    expect(graph[0].input.fixtureId).toBe('fixture')
    expect(graph[1].dependencies).toEqual(['fixture-setup'])
    validateTaskGraph(graph)
  })

  it('executes scoped Form validation independently of CTA navigation and page collectors', () => {
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
      scope: 'DIAGNOSTIC', checks: { 'flow-form-no-validation': 1 }, outcomes: [],
      verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'flow-form-no-validation', pageUrl: input.pageUrl, attemptId: 'attempt', parentAuditId: 'before' } })
    expect(graph.map(task => task.kind)).toEqual(['flow', 'finalize'])
    expect(graph[0].input.module).toBe('form-validation')
    expect(graph[0].dependencies).toEqual([])
    validateTaskGraph(graph)
  })

  it('checks every affected primary-action page without adding unrelated provider work', () => {
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
      scope: 'DIAGNOSTIC', checks: { 'flow-cta-404': 1 }, outcomes: [],
      verificationScopes: [{ pageUrl: input.pageUrl, phases: ['public_action'] }, { pageUrl: 'https://example.com/other', phases: ['public_action'] }],
      verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'flow-cta-404', pageUrl: input.pageUrl, attemptId: 'attempt', parentAuditId: 'before' } })
    expect(graph.map(task => task.kind).sort()).toEqual(['browser', 'browser', 'finalize', 'flow', 'flow'])
    expect(graph.filter(task => task.kind === 'flow').map(task => task.input.pageUrl)).toEqual([input.pageUrl, 'https://example.com/other'])
    validateTaskGraph(graph)
  })

  it('rechecks all affected section-link documents with only browser evidence and the section evaluator', () => {
    const graph = initialTaskPlan({ version: 1, engine: 'progressive-v1', targetUrl: input.pageUrl, environment: 'production',
      scope: 'DIAGNOSTIC', checks: { 'broken-page-anchors': 1 }, outcomes: [],
      verificationScopes: [{ pageUrl: input.pageUrl, phases: ['page_load'] }, { pageUrl: 'https://example.com/other', phases: ['page_load'] }],
      verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'broken-page-anchors', pageUrl: input.pageUrl, attemptId: 'attempt', parentAuditId: 'before' } })
    expect(graph.map(task => task.kind).sort()).toEqual(['browser', 'browser', 'check', 'check', 'finalize'])
    expect(graph.filter(task => task.kind === 'check').map(task => task.input.module)).toEqual(['seo', 'seo'])
    validateTaskGraph(graph)
  })

})
