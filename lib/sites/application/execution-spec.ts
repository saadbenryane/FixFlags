import { accountAdmission } from '../accounts/store'
import type { AccountIntent } from '../accounts/contracts'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { trackingPageKey } from '@/lib/audit/tracking/identity'
import { initialTaskPlan, publicPageBehaviors } from '@/lib/audit/progressive/graph'
import type { TaskPlan } from '@/lib/audit/progressive/contracts'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { consoleObservationMinimum } from '@/lib/audit/console-evidence'
import { capturePageKey } from '@/lib/audit/browser/observation-scope'
import { validateBindingForOutcome } from './binding-config'
import { canonicalIntent, executionSpecSchema, readExecutionSpec, type ExecutionSpec } from '../domain/execution-spec'
import type { CategoryArea } from '../domain/execution-spec'
import { analysisEnvironmentWhere, includeLegacySiteAnalyses } from './analysis-scope'
import { loadLegacySiteAnalysisIds } from './legacy-analysis'
import { SiteRunRefusal } from './run-refusal'
import { monitoringResponsibility, monitoringBehaviorResponsibility, monitoringActionResponsibility, monitoringConsoleResponsibility } from './monitoring-responsibility'
import { readSupportingObservations } from '@/lib/audit/flag-observations'
import { originalPageActionContexts } from '@/lib/audit/flow/verification-context'
import { recordedPageUrls } from '../page-coverage'

type SpecOutcome = { id: string; kind: string; expectation?: string | null; bindingPolicy?: string;
  bindings: Array<{ key: string; version: number; mechanism: string; required: boolean; config: Prisma.JsonValue; scope?: Prisma.JsonValue | null }> }

export async function buildExecutionSpec(input: { projectId: string; targetUrl: string; environment: string;
  scope: ExecutionSpec['scope']; categoryArea?: CategoryArea; accountMode?: AccountIntent['mode']; outcomes: SpecOutcome[]; verificationTarget?: ExecutionSpec['verificationTarget'] }): Promise<ExecutionSpec> {
  let category: ExecutionSpec['category']
  let monitoringPages: ExecutionSpec['monitoringPages']
  let monitoringBehaviors: ExecutionSpec['monitoringBehaviors']
  let targetUrl = input.targetUrl
  if ((input.scope === 'SITE' && input.projectId) || input.scope === 'CATEGORY') {
    if (input.scope === 'CATEGORY' && !input.categoryArea) throw new SiteRunRefusal('Select a category to check.', 400)
    const legacyIds = await loadLegacySiteAnalysisIds([input.projectId])
    const source = await prisma.audit.findFirst({ where: { projectId: input.projectId,
      ...(input.scope === 'CATEGORY' ? { status: 'COMPLETED' as const } : {}), ...includeLegacySiteAnalyses(legacyIds),
      AND: [analysisEnvironmentWhere(input.environment)] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, url: true, executionSpec: true, pages: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 24, select: { url: true } },
        verifierExecutions: { where: { workKind: 'browser' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 24, select: { targetKey: true, workKind: true, pageUrl: true } } } })
    if (input.scope === 'CATEGORY') {
      if (!source) throw new SiteRunRefusal('Run a website check before rechecking a category.', 409)
      targetUrl = source.url
    }
    const prior = readExecutionSpec(source?.executionSpec)
    const compatible = prior?.scope === 'SITE' && prior.targetUrl === source?.url && prior.environment === input.environment
    // The Site can enter at its configured origin after a URL-first analysis
    // began on another page. Keep that source's admitted responsibility.
    const recorded = [...(source?.url ? [source.url] : []), ...recordedPageUrls({ executionSpec: compatible ? prior : null,
      pages: source?.pages ?? [], executions: source?.verifierExecutions })]
    const pages = await monitoringResponsibility({ projectId: input.projectId, environment: input.environment, targetUrl, recorded })
    monitoringBehaviors = await monitoringBehaviorResponsibility({ projectId: input.projectId, environment: input.environment, pages,
      recordedEntries: [...(source?.url ? [source.url] : []), ...(compatible ? prior.monitoringEntryPages ?? [] : [])], recordedBehaviors: compatible ? prior.monitoringBehaviors : undefined })
    const actions = await monitoringActionResponsibility({ projectId: input.projectId, environment: input.environment, pages })
    monitoringBehaviors = pages.flatMap(pageUrl => {
      const behaviors = monitoringBehaviors!.find(scope => scope.pageUrl === pageUrl)?.behaviors ?? []
      const actionContexts = actions.get(pageUrl)
      return behaviors.length || actionContexts?.length ? [{ pageUrl, behaviors, ...(actionContexts?.length ? { actionContexts } : {}) }] : []
    })
    if (input.scope === 'CATEGORY') category = { area: input.categoryArea!, sourceAuditId: source!.id, pages }
    else if (recorded.length || pages.length > 1) monitoringPages = pages
  }
  const outcomes = input.outcomes.map(outcome => ({ id: outcome.id, kind: outcome.kind,
    expectation: outcome.expectation ?? null, bindingPolicy: outcome.bindingPolicy ?? 'ALL_REQUIRED',
    bindings: outcome.bindings.map(binding => {
      const validated = validateBindingForOutcome(outcome.kind as Parameters<typeof validateBindingForOutcome>[0], binding.mechanism as Parameters<typeof validateBindingForOutcome>[1], binding.config)
      return { key: binding.key, version: binding.version, mechanism: binding.mechanism,
        required: binding.required, config: validated.success ? validated.data.config : {},
        ...(!validated.success ? { configurationError: validated.reason } : {}), scope: binding.scope ?? null }
    }),
  }))
  for (const outcome of outcomes) for (const binding of outcome.bindings) {
    if (binding.mechanism !== 'SAFE_FORM') continue
    const config = binding.config as { fixtureId?: string }
    if (!config.fixtureId) continue
    const fixture = await prisma.outcomeFixture.findFirst({ where: { id: config.fixtureId, projectId: input.projectId }, select: { id: true, version: true } })
    if (fixture) Object.assign(binding, { fixture: { id: fixture.id, version: fixture.version } })
  }
  let verificationScopes: ExecutionSpec['verificationScopes']
  let verificationSourceFlagIds: ExecutionSpec['verificationSourceFlagIds']
  let consoleObservationMs: number | undefined
  let consoleObservationScopes: ExecutionSpec['consoleObservationScopes']
  const diagnosticModule = input.verificationTarget?.kind === 'DIAGNOSTIC' ? CHECK_REGISTRY[input.verificationTarget.checkId.split('::page:')[0]]?.module : null
  if (input.verificationTarget?.kind === 'DIAGNOSTIC') {
    const attempt = await prisma.improvementAttempt.findFirst({ where: { id: input.verificationTarget.attemptId,
      sourceAuditId: input.verificationTarget.parentAuditId, improvement: { projectId: input.projectId } },
      select: { improvementId: true, sourceFlagIds: true } })
    if (attempt?.sourceFlagIds?.length) verificationSourceFlagIds = attempt.sourceFlagIds
    const flags = await prisma.flag.findMany({ where: { audit: { projectId: input.projectId,
      ...(verificationSourceFlagIds ? { AND: [analysisEnvironmentWhere(input.environment)] } : {}) },
      ...(verificationSourceFlagIds ? { id: { in: verificationSourceFlagIds }, improvementOccurrence: { improvementId: attempt!.improvementId } }
        : { auditId: input.verificationTarget.parentAuditId, pageUrl: input.verificationTarget.pageUrl, checkId: input.verificationTarget.checkId }) },
      take: verificationSourceFlagIds ? 5000 : 100, select: { pageUrl: true, verificationRule: true, evidenceTargets: true, affectedPaths: true, supportingObservations: true } })
    if (verificationSourceFlagIds && flags.length !== verificationSourceFlagIds.length)
      throw new SiteRunRefusal('The original repair scope is no longer available.', 409, 'REPAIR_SCOPE_UNAVAILABLE')
    const observations = flags.flatMap(flag => readSupportingObservations(flag.supportingObservations)?.items ?? [])
    const evidenceTargets = [...flags.flatMap(flag => Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets : []),
      ...observations.flatMap(item => item.evidenceTargets)]
    if (diagnosticModule === 'console') consoleObservationMs = Math.max(2000, ...flags.map(flag => consoleObservationMinimum(flag.evidenceTargets)))
    const contexts = evidenceTargets.flatMap(value => {
      const context = value && typeof value === 'object' && !Array.isArray(value) ? value.context : null
      return typeof context === 'string' && context.startsWith('tracking:') && context.length <= 4200 ? [context] : []
    })
    const pages = [...new Set([input.verificationTarget.pageUrl, ...flags.flatMap(flag => flag.pageUrl ? [flag.pageUrl] : []), ...observations.flatMap(item => item.pageUrl ? [item.pageUrl] : []),
      ...flags.flatMap(flag => Array.isArray(flag.affectedPaths) ? flag.affectedPaths.filter((page): page is string => typeof page === 'string') : [])])]
    verificationScopes = pages.map(pageUrl => ({ pageUrl, phases: diagnosticModule === 'flow' ? ['public_action'] : diagnosticModule !== 'measurement' ? ['page_load'] : (['page_load', 'public_action'] as const).filter(phase =>
      contexts.some(context => context.startsWith('tracking:' + phase + ':') && context.endsWith(':page:' + trackingPageKey(pageUrl)))) }))
    if (diagnosticModule === 'flow' || diagnosticModule === 'form-validation')
      verificationScopes = verificationScopes.map(scope => ({ ...scope, actionContexts: originalPageActionContexts(flags, scope.pageUrl) }))
    if (diagnosticModule === 'overlays') {
      const contexts = evidenceTargets.flatMap(value => {
        const context = value && typeof value === 'object' && !Array.isArray(value) ? value.context : null
        return typeof context === 'string' && /^overlay:[a-f0-9]{64}:[a-f0-9]{64}:(page_load|primary_action(?:_after)?|pricing_navigation(?:_after)?|(?:flow_)?form_validation(?:_after)?|journey_[a-z0-9_-]+):(nav|cta|form):[a-f0-9]{64}$/.test(context) ? [context] : []
      })
      verificationScopes = verificationScopes.map(scope => ({ ...scope, overlayPhases: [...new Set(contexts.filter(context =>
        context.startsWith('overlay:' + capturePageKey(scope.pageUrl) + ':')).map(context => context.split(':')[3]))] }))
    }

  }
  if (input.scope === 'SITE' || category?.area === 'conversion') {
    // Carry recorded error horizons into care runs. A fast, healthy navigation
    // must not silently shorten observation after an earlier delayed failure.
    const scopes = await monitoringConsoleResponsibility({ projectId: input.projectId, environment: input.environment,
      pages: category?.pages ?? monitoringPages ?? [targetUrl] })
    if (scopes.length) consoleObservationScopes = scopes
  }
  let accountChecks = (['SITE', 'ACCOUNT_CHECKS'].includes(input.scope) || category?.area === 'conversion' || input.verificationTarget?.kind === 'DIAGNOSTIC' && input.verificationTarget.checkId.startsWith('account-')) ? await accountAdmission(input.projectId, input.verificationTarget?.kind === 'DIAGNOSTIC' && input.verificationTarget.checkId === 'account-signup-failed' ? 'retest' : input.accountMode) : undefined
  if (accountChecks?.siteUrl && new URL(accountChecks.siteUrl).origin !== new URL(input.targetUrl).origin) accountChecks = undefined
  const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', browserCollection: 'per-profile-v1', targetUrl, environment: input.environment,
    scope: input.scope, ...(category ? { category } : {}), checks: Object.fromEntries(Object.entries(CHECK_REGISTRY)
      .filter(([, definition]) => !category || definition.area === category.area)
      .map(([id, definition]) => [id, definition.version])),
    ...(accountChecks ? { accountChecks } : {}), outcomes, verificationTarget: input.verificationTarget ?? null, ...(verificationScopes ? { verificationScopes } : {}),
    ...(verificationSourceFlagIds ? { verificationSourceFlagIds } : {}),
    ...(monitoringPages ? { monitoringPages } : {}), ...(monitoringBehaviors ? { monitoringBehaviors } : {}),
    ...(consoleObservationMs !== undefined ? { consoleObservationMs } : {}), ...(consoleObservationScopes ? { consoleObservationScopes } : {}) })
  if (spec.scope !== 'SITE' && spec.scope !== 'CATEGORY') return spec
  const pages = spec.category?.pages ?? spec.monitoringPages ?? [spec.targetUrl]
  return executionSpecSchema.parse({ ...spec, monitoringBehaviors: pages.flatMap((pageUrl, position) => {
    const behaviors = publicPageBehaviors({ pageUrl, primary: position === 0 }, spec)
    const actionContexts = spec.monitoringBehaviors?.find(scope => scope.pageUrl === pageUrl)?.actionContexts
    return behaviors.length || actionContexts?.length ? [{ pageUrl, behaviors, ...(actionContexts ? { actionContexts } : {}) }] : []
  }) })
}

/** Responsibility selection is a set. Preserve execution order in the snapshot,
 * but database row ordering cannot turn a retry into a different intent. */
export function canonicalExecutionOutcomes(outcomes: ExecutionSpec['outcomes']) {
  return outcomes.toSorted((left, right) => left.id.localeCompare(right.id)).map(outcome => ({ ...outcome,
    bindings: outcome.bindings.toSorted((left, right) => left.key.localeCompare(right.key)),
  }))
}

/** Different request keys may share live work only when its frozen plan covers
 * the requested obligations. Exact keyed replay keeps its original snapshot. */
export function monitoringExecutionCovers(admitted: ExecutionSpec, requested: ExecutionSpec): boolean {
  const identity = (task: TaskPlan) => JSON.stringify([task.scope, task.kind, task.input.module ?? null,
    task.input.device ?? null, task.input.outcomeId ?? null, task.input.bindingKey ?? null])
  try {
    // Compare the complete admitted page intent. The physical execution keeps
    // its own policy-selected depth; this read cannot expand that execution.
    const available = new Map(initialTaskPlan({ ...admitted, reviewDepth: 3 }).map(task => [identity(task), task]))
    return initialTaskPlan({ ...requested, reviewDepth: 3 }).every(task => {
      const prior = available.get(identity(task))
      if (!prior) return false
      const contexts = new Set(prior.input.verificationContexts ?? [])
      return (task.input.verificationContexts ?? []).every(context => contexts.has(context))
    })
  } catch {
    // Unreadable historical work cannot establish compatibility.
    return false
  }
}

export function executionIntentHash(spec: ExecutionSpec) {
  // Depth and verification scopes are derived at admission, not by this
  // command's caller. Both ledgers retain that snapshot; replay identity remains
  // the requested target, checks, explicit bindings, revisions and verification
  // intent. A broad caller selects the Site, not its automatically derived bindings.
  return createHash('sha256').update(canonicalIntent({ ...spec, outcomes: spec.scope === 'SITE' || spec.scope === 'CATEGORY' ? [] : canonicalExecutionOutcomes(spec.outcomes),
    targetUrl: spec.category ? undefined : spec.targetUrl,
    category: spec.category ? { area: spec.category.area } : undefined,
    browserCollection: undefined, scanAccess: undefined, reviewDepth: undefined, monitoringPages: undefined, monitoringEntryPages: undefined, monitoringBehaviors: undefined, verificationScopes: undefined, consoleObservationMs: undefined, consoleObservationScopes: undefined })).digest('hex')
}
