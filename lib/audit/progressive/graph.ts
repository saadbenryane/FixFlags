import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { validateTaskGraph, type TaskPlan, type TaskInput, type TaskKind } from './contracts'
import { SEARCH_CHECK_REGISTRY } from '../search/definitions'
import { ACTION_CHECK_DEFINITIONS } from '../checks/definitions'
import { motionRequested } from '../checks/motion-evidence'
import { monitoringReviewUrls } from '../review-depth'

export function pageTaskPlan(input: TaskInput, spec: ExecutionSpec): TaskPlan[] {
  const prefix = 'p' + input.position, scope = 'page:' + input.pageUrl
  const make = (kind: TaskKind, dependencies: string[] = [], module?: string): TaskPlan => ({
    key: prefix + ':' + (module ?? kind), kind, scope, input: { ...input, ...(module ? { module } : {}) }, dependencies,
  })
  const plans = [make('http'), make('browser'), make('captures'),
    { ...make('pagespeed', [], 'pagespeed-desktop'), input: { ...input, device: 'desktop' as const } },
    { ...make('pagespeed', [], 'pagespeed-mobile'), input: { ...input, device: 'mobile' as const } }]
  const modules = new Set(Object.keys(spec.checks).flatMap(id => CHECK_REGISTRY[id]?.module ? [CHECK_REGISTRY[id].module] : []))
  if (motionRequested(spec)) plans.push(make('motion', [prefix + ':browser']))
  if (modules.has('overlays')) plans.push({ ...make('overlays'), input: { ...input, device: 'desktop' } },
    { ...make('overlays', [], 'overlays-mobile'), input: { ...input, device: 'mobile' } })
  if (modules.has('keyboard')) plans.push(make('keyboard', [], 'keyboard-evidence'))
  if (modules.has('mobile-navigation')) plans.push(make('flow', [], 'mobile-navigation'))
  for (const [module, definition] of Object.entries(CHECK_MODULES)) {
    if (module === 'automatic-accounts' || module === 'search' || ACTION_CHECK_DEFINITIONS[module] || !modules.has(module)) continue
    const inputKind = definition.input === 'keyboard' ? 'keyboard-evidence' : module === 'security' || definition.input === 'headers' ? 'http'
      : definition.input === 'performance' ? 'pagespeed-desktop' : definition.input === 'mobile' ? 'pagespeed-mobile' : 'browser'
    plans.push(make('check', [prefix + ':' + inputKind, ...(module === 'interaction' && motionRequested(spec) ? [prefix + ':motion'] : [])], module))
    if (module === 'performance') plans.push({ ...make('check', [prefix + ':pagespeed-mobile'], 'inp-mobile'),
      input: { ...input, module: 'performance', device: 'mobile' } })
  }
  if (modules.has('form-validation') || modules.has('overlays') && spec.verificationScopes?.some(scope => scope.pageUrl === input.pageUrl &&
    scope.overlayPhases?.some(phase => phase.startsWith('form_validation')))) plans.push(make('flow', [], 'form-validation'))
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
  if (input.primary || spec.category && ['conversion', 'tracking'].includes(spec.category.area) || spec.scope === 'DIAGNOSTIC' &&
    (modules.has('overlays') || spec.verificationScopes?.some(scope => scope.pageUrl === input.pageUrl && scope.phases.includes('public_action'))))
    plans.push(make('flow', [prefix + ':browser']))
  if (input.primary || spec.scope === 'DIAGNOSTIC' && modules.has('slow-replay')) plans.push(make('slow-replay'))
  if (input.primary || spec.scope === 'DIAGNOSTIC' && (modules.has('overlays') || modules.has('journeys'))) {
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
  const accounts: TaskPlan[] = spec.accountChecks ? [{ kind: 'automatic-accounts', key: 'automatic-accounts', scope: 'accounts', input, dependencies: [] }] : []
  if (spec.scope === 'ACCOUNT_CHECKS') return [...accounts, { kind: 'finalize', key: 'finalize', scope: 'accounts', input, dependencies: ['automatic-accounts'] }]
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
  if (spec.scope === 'CATEGORY' && spec.category) {
    const area = spec.category.area
    const pages = spec.category.pages.flatMap((pageUrl, position) => pageTaskPlan({ ...input, pageUrl, position,
      primary: position === 0, role: position === 0 ? 'primary' : 'linked' }, spec))
    const available = new Map([...siteResourcePlans(input), ...accounts, ...pages].map(task => [task.key, task]))
    const selected = new Set<string>()
    const include = (key: string) => {
      if (selected.has(key)) return
      const task = available.get(key)
      if (!task) throw new Error('Category dependency is unavailable: ' + key)
      selected.add(key); task.dependencies.forEach(include)
    }
    for (const task of pages) if (['http', 'browser', 'check'].includes(task.kind) ||
      area === 'search' && ['search', 'google'].includes(task.kind) ||
      area === 'performance' && task.kind === 'slow-replay' ||
      (area === 'conversion' || area === 'tracking') && task.kind === 'flow' ||
      area === 'conversion' && ['bindings', 'journeys', 'overlays'].includes(task.kind)) include(task.key)
    for (const task of accounts) include(task.key)
    const plans = [...selected].map(key => available.get(key)!)
    if (area === 'search' || Object.keys(spec.checks).some(id => CHECK_REGISTRY[id]?.module === 'corridor'))
      plans.push({ kind: 'cross-page', key: 'cross-page', scope: 'category:' + area, input,
        dependencies: pages.filter(task => task.kind === 'browser' || area === 'search' && task.kind === 'search' && task.input.module === 'summary').map(task => task.key) })
    plans.push({ kind: 'finalize', key: 'finalize', scope: 'category:' + area, input, dependencies: plans.map(task => task.key) })
    validateTaskGraph(plans)
    return plans
  }
  if (spec.scope === 'DIAGNOSTIC' && spec.accountChecks && spec.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.startsWith('account-'))
    return [...accounts, { kind: 'finalize', key: 'finalize', scope: 'diagnostic', input, dependencies: ['automatic-accounts'] }]
  if (spec.scope === 'DIAGNOSTIC' && spec.verificationTarget?.kind === 'DIAGNOSTIC') {
    const checkId = spec.verificationTarget.checkId.split('::page:')[0]
    const search = SEARCH_CHECK_REGISTRY[checkId as keyof typeof SEARCH_CHECK_REGISTRY]
    const checkModule = CHECK_REGISTRY[checkId]?.module
    const scopes = spec.verificationScopes ?? []
    const extraPages = scopes.filter(scope => scope.pageUrl !== input.pageUrl)
    const pages = [ ...pageTaskPlan(input, spec), ...extraPages.flatMap((scope, index) =>
      pageTaskPlan({ ...input, pageUrl: scope.pageUrl, position: index + 1, primary: false, role: 'linked' }, spec)) ]
    if (checkModule === 'corridor') {
      const collectors = pages.filter(task => task.kind === 'browser')
      const plans: TaskPlan[] = [...collectors,
        { kind: 'cross-page', key: 'cross-page', scope: 'diagnostic', input, dependencies: collectors.map(task => task.key) },
        { kind: 'finalize', key: 'finalize', scope: 'diagnostic', input, dependencies: [...collectors.map(task => task.key), 'cross-page'] }]
      validateTaskGraph(plans)
      return plans
    }
    const resources = siteResourcePlans(input)
    const available = new Map([...resources, ...pages].map(task => [task.key, task]))
    const target = checkId === 'inp-critical' || checkId === 'inp-poor' ? 'p0:inp-mobile'
      : search ? search.responsibility === 'google' ? checkId === 'low-ctr' ? 'p0:google-performance' : 'p0:google-index'
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
    if (checkModule === 'overlays') {
      for (const [index, pageUrl] of [input.pageUrl, ...extraPages.map(scope => scope.pageUrl)].entries()) {
        const prefix = 'p' + index, phases = scopes.find(scope => scope.pageUrl === pageUrl)?.overlayPhases
        if (!phases?.length || phases.includes('page_load')) { include(prefix + ':overlays'); include(prefix + ':overlays-mobile') }
        if (phases?.some(phase => phase.startsWith('primary_action') || phase.startsWith('pricing_navigation') || phase.startsWith('flow_form_validation'))) include(prefix + ':flow')
        if (phases?.some(phase => phase.startsWith('form_validation'))) include(prefix + ':form-validation')
        if (phases?.some(phase => phase.startsWith('journey_'))) include(prefix + ':journeys')
      }
    } else include(target)
    if (scopes.length && checkModule !== 'overlays') {
      if (scopes.find(scope => scope.pageUrl === input.pageUrl)?.phases.includes('public_action')) include('p0:flow')
      for (const [index, scope] of extraPages.entries()) {
        include(target.replace(/^p0:/, 'p' + (index + 1) + ':'))
        if (scope.phases.includes('public_action')) include('p' + (index + 1) + ':flow')
      }
    }
    const plans: TaskPlan[] = [...selected].map(key => available.get(key)!)
    plans.push({ kind: 'finalize', key: 'finalize', scope: 'diagnostic', input, dependencies: [...selected] })
    validateTaskGraph(plans)
    return plans
  }
  const retained = (spec.reviewDepth ?? 1) >= 2 ? monitoringReviewUrls(input.pageUrl, spec.monitoringPages ?? []) : [input.pageUrl]
  const pages = retained.flatMap((pageUrl, position) => pageTaskPlan({ ...input, pageUrl, position,
    primary: position === 0, role: position === 0 ? 'primary' : 'linked' }, spec))
  const plans: TaskPlan[] = [
    ...siteResourcePlans(input),
    ...accounts,
    ...pages,
    { kind: 'discovery', key: 'discovery', scope: 'site', input, dependencies: ['p0:browser', 'p0:http'] },
    { kind: 'cross-page', key: 'cross-page', scope: 'site', input, dependencies: ['discovery', ...pages.filter(task => task.kind === 'search' && task.input.module === 'summary').map(task => task.key)] },
    { kind: 'finalize', key: 'finalize', scope: 'site', input, dependencies: ['resources', 'discovery', 'cross-page', ...pages.map(task => task.key), ...accounts.map(task => task.key)] },
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
