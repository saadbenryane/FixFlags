import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { validateTaskGraph, type TaskPlan, type TaskInput, type TaskKind } from './contracts'
import { SEARCH_CHECK_REGISTRY } from '../search/definitions'

export function pageTaskPlan(input: TaskInput, spec: ExecutionSpec): TaskPlan[] {
  const prefix = 'p' + input.position, scope = 'page:' + input.pageUrl
  const make = (kind: TaskKind, dependencies: string[] = [], module?: string): TaskPlan => ({
    key: prefix + ':' + (module ?? kind), kind, scope, input: { ...input, ...(module ? { module } : {}) }, dependencies,
  })
  const plans = [make('http'), make('browser'), make('captures'),
    { ...make('pagespeed', [], 'pagespeed-desktop'), input: { ...input, device: 'desktop' as const } },
    { ...make('pagespeed', [], 'pagespeed-mobile'), input: { ...input, device: 'mobile' as const } }]
  const modules = new Set(Object.keys(spec.checks).flatMap(id => CHECK_REGISTRY[id]?.module ? [CHECK_REGISTRY[id].module] : []))
  if (modules.has('keyboard')) plans.push(make('keyboard', [], 'keyboard-evidence'))
  for (const [module, definition] of Object.entries(CHECK_MODULES)) {
    if (module === 'search' || !modules.has(module)) continue
    const inputKind = definition.input === 'keyboard' ? 'keyboard-evidence' : module === 'security' || definition.input === 'headers' ? 'http'
      : definition.input === 'performance' ? 'pagespeed-desktop' : definition.input === 'mobile' ? 'pagespeed-mobile' : 'browser'
    plans.push(make('check', [prefix + ':' + inputKind], module))
    if (module === 'performance') plans.push({ ...make('check', [prefix + ':pagespeed-desktop', prefix + ':pagespeed-mobile'], 'inp-mobile'),
      input: { ...input, module: 'performance', device: 'mobile' } })
  }
  for (const [evaluator, dependencies] of Object.entries({
    presentation: [prefix + ':http', prefix + ':browser'],
    indexing: [prefix + ':http', prefix + ':browser', 'resources'],
    crawl: [prefix + ':http', 'robots'],
    canonical: [prefix + ':http', prefix + ':browser'],
    discovery: [prefix + ':http', prefix + ':browser', 'resources'],
    'structured-data': [prefix + ':http', prefix + ':browser'],
  })) plans.push(make('search', dependencies, 'search-' + evaluator))
  plans.push({ ...make('search', plans.filter(task => task.kind === 'search').map(task => task.key)),
    input: { ...input, module: 'summary' } })
  plans.push(make('google', [prefix + ':search-indexing'], 'google-index'))
  plans.push(make('google', [], 'google-performance'))
  if (input.primary || spec.scope === 'DIAGNOSTIC' && spec.verificationScopes?.some(scope => scope.pageUrl === input.pageUrl && scope.phases.includes('public_action')))
    plans.push(make('flow', [prefix + ':browser']))
  if (input.primary) {
    plans.push(make('slow-replay', [prefix + ':browser']))
    plans.push(make('journeys', [prefix + ':browser']))
    for (const outcome of spec.outcomes) for (const binding of outcome.bindings.filter(item => item.required)) {
      plans.push({ kind: 'bindings', key: 'binding:' + outcome.id + ':' + binding.key, scope: 'outcome:' + outcome.id,
        input: { ...input, outcomeId: outcome.id, bindingKey: binding.key, module: binding.mechanism,
          ...(binding.fixture ? { fixtureId: binding.fixture.id } : {}) }, dependencies: [] })
    }
  }
  // Analysis explanation reads recorded observations; it never supplies assertion success.
  plans.push(make('judge', plans.filter(task => !['google', 'bindings', 'journeys'].includes(task.kind)).map(task => task.key)))
  return plans
}

export function initialTaskPlan(spec: ExecutionSpec): TaskPlan[] {
  const input: TaskInput = { pageUrl: spec.targetUrl, position: 0, primary: true, role: 'primary' }
  if (spec.scope === 'FIXTURE_SETUP') {
    if (!spec.fixtureSetup) throw new Error('Signup setup is missing its fixture')
    return [
      { kind: 'fixture-setup', key: 'fixture-setup', scope: 'fixture:' + spec.fixtureSetup.id,
        input: { ...input, fixtureId: spec.fixtureSetup.id }, dependencies: [] },
      { kind: 'finalize', key: 'finalize', scope: 'fixture-setup', input, dependencies: ['fixture-setup'] },
    ]
  }
  if (spec.scope === 'OUTCOMES') {
    const bindings: TaskPlan[] = spec.outcomes.flatMap(outcome => outcome.bindings.filter(binding => binding.required).map(binding => ({
      kind: 'bindings', key: 'binding:' + outcome.id + ':' + binding.key, scope: 'outcome:' + outcome.id,
      input: { ...input, outcomeId: outcome.id, bindingKey: binding.key, module: binding.mechanism,
        ...(binding.fixture ? { fixtureId: binding.fixture.id } : {}) }, dependencies: [],
    })))
    const plans: TaskPlan[] = [...bindings, { kind: 'finalize', key: 'finalize', scope: 'outcomes', input,
      dependencies: bindings.map(binding => binding.key) }]
    validateTaskGraph(plans)
    return plans
  }
  if (spec.scope === 'DIAGNOSTIC' && spec.verificationTarget?.kind === 'DIAGNOSTIC') {
    const checkId = spec.verificationTarget.checkId.split('::page:')[0]
    const search = SEARCH_CHECK_REGISTRY[checkId as keyof typeof SEARCH_CHECK_REGISTRY]
    const checkModule = CHECK_REGISTRY[checkId]?.module
    const scopes = checkModule === 'measurement' ? spec.verificationScopes ?? [] : []
    const extraPages = scopes.filter(scope => scope.pageUrl !== input.pageUrl)
    const pages = [ ...pageTaskPlan(input, spec), ...extraPages.flatMap((scope, index) =>
      pageTaskPlan({ ...input, pageUrl: scope.pageUrl, position: index + 1, primary: false, role: 'linked' }, spec)) ]
    const resources = siteResourcePlans(input)
    const available = new Map([...resources, ...pages].map(task => [task.key, task]))
    const target = search ? search.responsibility === 'google' ? checkId === 'low-ctr' ? 'p0:google-performance' : 'p0:google-index'
      : search.evaluator === 'cross-page' ? null : 'p0:search-' + search.evaluator : checkModule && available.has('p0:' + checkModule) ? 'p0:' + checkModule : null
    // Unknown historical targets remain an explicit limitation, not a made-up
    // successful execution or a broad scan substituted for the named verifier.
    if (!target) throw new Error('Diagnostic verifier is not registered: ' + checkId)
    const selected = new Set<string>()
    const include = (key: string) => {
      if (selected.has(key)) return
      const task = available.get(key)
      if (!task) throw new Error('Diagnostic dependency is unavailable: ' + key)
      selected.add(key); task.dependencies.forEach(include)
    }
    include(target)
    if (checkModule === 'measurement') {
      if (scopes.find(scope => scope.pageUrl === input.pageUrl)?.phases.includes('public_action')) include('p0:flow')
      for (const [index, scope] of extraPages.entries()) {
        include('p' + (index + 1) + ':measurement')
        if (scope.phases.includes('public_action')) include('p' + (index + 1) + ':flow')
      }
    }
    const plans: TaskPlan[] = [...selected].map(key => available.get(key)!)
    plans.push({ kind: 'finalize', key: 'finalize', scope: 'diagnostic', input, dependencies: [...selected] })
    validateTaskGraph(plans)
    return plans
  }
  const pages = pageTaskPlan(input, spec)
  const plans: TaskPlan[] = [
    ...siteResourcePlans(input),
    ...pages,
    { kind: 'discovery', key: 'discovery', scope: 'site', input, dependencies: ['p0:browser', 'p0:http'] },
    { kind: 'cross-page', key: 'cross-page', scope: 'site', input, dependencies: ['discovery', 'p0:search'] },
    { kind: 'finalize', key: 'finalize', scope: 'site', input, dependencies: ['resources', 'discovery', 'cross-page', ...pages.map(task => task.key)] },
  ]
  validateTaskGraph(plans)
  return plans
}

export function availabilityOnly(spec: ExecutionSpec) {
  const bindings = spec.outcomes.flatMap(outcome => outcome.bindings.filter(binding => binding.required))
  return spec.scope === 'OUTCOMES' && bindings.length > 0 && bindings.every(binding => binding.mechanism === 'HTTP_AVAILABILITY')
}

function siteResourcePlans(input: TaskInput): TaskPlan[] {
  const scope = 'origin:' + new URL(input.pageUrl).origin
  return [
    { kind: 'search-resources', key: 'robots', scope, input: { ...input, module: 'robots' }, dependencies: [] },
    { kind: 'search-resources', key: 'resources', scope, input, dependencies: ['robots'] },
  ]
}
