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
  for (const [module, definition] of Object.entries(CHECK_MODULES)) {
    if (module === 'search' || !modules.has(module)) continue
    const inputKind = module === 'security' || definition.input === 'headers' ? 'http'
      : definition.input === 'performance' ? 'pagespeed-desktop' : definition.input === 'mobile' ? 'pagespeed-mobile' : 'browser'
    plans.push(make('check', [prefix + ':' + inputKind], module))
    if (module === 'performance') plans.push({ ...make('check', [prefix + ':pagespeed-desktop', prefix + ':pagespeed-mobile'], 'inp-mobile'),
      input: { ...input, module: 'performance', device: 'mobile' } })
  }
  plans.push(make('search', [prefix + ':http', prefix + ':browser', 'resources']))
  plans.push(make('google', [prefix + ':search'], 'google-index'))
  plans.push(make('google', [], 'google-performance'))
  if (input.primary) {
    plans.push(make('flow', [prefix + ':browser']))
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
    const pages = pageTaskPlan(input, spec)
    const resource: TaskPlan = { kind: 'search-resources', key: 'resources', scope: 'origin:' + new URL(input.pageUrl).origin, input, dependencies: [] }
    const available = new Map([resource, ...pages].map(task => [task.key, task]))
    const target = search ? search.responsibility === 'google' ? checkId === 'low-ctr' ? 'p0:google-performance' : 'p0:google-index'
      : 'p0:search' : checkModule && available.has('p0:' + checkModule) ? 'p0:' + checkModule : null
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
    const plans: TaskPlan[] = [...selected].map(key => available.get(key)!)
    plans.push({ kind: 'finalize', key: 'finalize', scope: 'diagnostic', input, dependencies: [...selected] })
    validateTaskGraph(plans)
    return plans
  }
  const pages = pageTaskPlan(input, spec)
  const plans: TaskPlan[] = [
    { kind: 'search-resources', key: 'resources', scope: 'origin:' + new URL(spec.targetUrl).origin, input, dependencies: [] },
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
