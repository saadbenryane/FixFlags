import { accountAdmission } from '../accounts/store'
import type { AccountIntent } from '../accounts/contracts'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { trackingPageKey } from '@/lib/audit/tracking/identity'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { consoleObservationMinimum } from '@/lib/audit/console-evidence'
import { validateBindingForOutcome } from './binding-config'
import { canonicalIntent, executionSpecSchema, type ExecutionSpec } from '../domain/execution-spec'
import type { CategoryArea } from '../domain/execution-spec'
import { siteWideAnalysisAuditWhere } from './analysis-scope'
import { SiteRunRefusal } from './run-refusal'

type SpecOutcome = { id: string; kind: string; expectation?: string | null; bindingPolicy?: string;
  bindings: Array<{ key: string; version: number; mechanism: string; required: boolean; config: Prisma.JsonValue; scope?: Prisma.JsonValue | null }> }

export async function buildExecutionSpec(input: { projectId: string; targetUrl: string; environment: string;
  scope: ExecutionSpec['scope']; categoryArea?: CategoryArea; accountMode?: AccountIntent['mode']; outcomes: SpecOutcome[]; verificationTarget?: ExecutionSpec['verificationTarget'] }): Promise<ExecutionSpec> {
  let category: ExecutionSpec['category']
  let targetUrl = input.targetUrl
  if (input.scope === 'CATEGORY') {
    if (!input.categoryArea) throw new SiteRunRefusal('Select a category to check.', 400)
    const source = await prisma.audit.findFirst({ where: { projectId: input.projectId, status: 'COMPLETED', ...siteWideAnalysisAuditWhere,
      AND: [input.environment === 'production' ? { OR: [
        { executionSpec: { path: ['environment'], equals: input.environment } },
        { executionSpec: { path: ['environment'], equals: Prisma.AnyNull } },
      ] } : { executionSpec: { path: ['environment'], equals: input.environment } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, url: true,
        pages: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 24, select: { url: true } } } })
    if (!source) throw new SiteRunRefusal('Run a website check before rechecking a category.', 409)
    targetUrl = source.url
    category = { area: input.categoryArea, sourceAuditId: source.id,
      pages: [...new Set([targetUrl, ...source.pages.map(page => page.url)])].slice(0, 24) }
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
  let consoleObservationMs: number | undefined
  let consoleObservationScopes: ExecutionSpec['consoleObservationScopes']
  const diagnosticModule = input.verificationTarget?.kind === 'DIAGNOSTIC' ? CHECK_REGISTRY[input.verificationTarget.checkId.split('::page:')[0]]?.module : null
  if (input.verificationTarget?.kind === 'DIAGNOSTIC') {
    const flags = await prisma.flag.findMany({ where: { auditId: input.verificationTarget.parentAuditId,
      audit: { projectId: input.projectId }, pageUrl: input.verificationTarget.pageUrl,
      checkId: input.verificationTarget.checkId }, take: 100, select: { evidenceTargets: true, affectedPaths: true } })
    if (diagnosticModule === 'console') consoleObservationMs = Math.max(2000, ...flags.map(flag => consoleObservationMinimum(flag.evidenceTargets)))
    const contexts = flags.flatMap(flag => Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.flatMap(value => {
      const context = value && typeof value === 'object' && !Array.isArray(value) ? value.context : null
      return typeof context === 'string' && context.startsWith('tracking:') && context.length <= 4200 ? [context] : []
    }) : [])
    const pages = [...new Map([input.verificationTarget.pageUrl, ...flags.flatMap(flag => Array.isArray(flag.affectedPaths) ? flag.affectedPaths.filter((page): page is string => typeof page === 'string') : [])].map(page => [trackingPageKey(page), page])).values()]
    verificationScopes = pages.map(pageUrl => ({ pageUrl, phases: diagnosticModule === 'flow' ? ['public_action'] : diagnosticModule !== 'measurement' ? ['page_load'] : (['page_load', 'public_action'] as const).filter(phase =>
      contexts.some(context => context.startsWith('tracking:' + phase + ':') && context.endsWith(':page:' + trackingPageKey(pageUrl)))) }))

  }
  if (input.scope === 'SITE' || category?.area === 'conversion') {
    // Carry recorded error horizons into care runs. A fast, healthy navigation
    // must not silently shorten observation after an earlier delayed failure.
    const flags = await prisma.flag.findMany({ where: { audit: { projectId: input.projectId, status: 'COMPLETED' },
      OR: [{ checkId: { startsWith: 'console-errors-critical' } }, { checkId: { startsWith: 'console-errors-some' } }] },
      orderBy: { createdAt: 'desc' }, take: 100, select: { evidenceTargets: true, pageUrl: true, affectedPaths: true } })
    const windows = new Map<string, number>()
    for (const flag of flags) {
      const pages = [flag.pageUrl, ...(Array.isArray(flag.affectedPaths) ? flag.affectedPaths : [])]
      for (const page of pages) if (typeof page === 'string' && URL.canParse(page)) {
        const pageUrl = new URL(page).href
        const minimum = consoleObservationMinimum(flag.evidenceTargets, pageUrl)
        if (minimum && (windows.has(pageUrl) || windows.size < 100)) windows.set(pageUrl, Math.max(2000, minimum, windows.get(pageUrl) ?? 0))
      }
    }
    if (windows.size) consoleObservationScopes = [...windows].map(([pageUrl, minimumMs]) => ({ pageUrl, minimumMs }))
  }
  let accountChecks = (['SITE', 'ACCOUNT_CHECKS'].includes(input.scope) || category?.area === 'conversion' || input.verificationTarget?.kind === 'DIAGNOSTIC' && input.verificationTarget.checkId.startsWith('account-')) ? await accountAdmission(input.projectId, input.verificationTarget?.kind === 'DIAGNOSTIC' && input.verificationTarget.checkId === 'account-signup-failed' ? 'retest' : input.accountMode) : undefined
  if (accountChecks?.siteUrl && new URL(accountChecks.siteUrl).origin !== new URL(input.targetUrl).origin) accountChecks = undefined
  return executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', targetUrl, environment: input.environment,
    scope: input.scope, ...(category ? { category } : {}), checks: Object.fromEntries(Object.entries(CHECK_REGISTRY)
      .filter(([id, definition]) => !category || definition.area === category.area || category.area === 'search' && id.startsWith('corridor-og-'))
      .map(([id, definition]) => [id, definition.version])),
    ...(accountChecks ? { accountChecks } : {}), outcomes, verificationTarget: input.verificationTarget ?? null, ...(verificationScopes ? { verificationScopes } : {}),
    ...(consoleObservationMs !== undefined ? { consoleObservationMs } : {}), ...(consoleObservationScopes ? { consoleObservationScopes } : {}) })
}

/** Responsibility selection is a set. Preserve execution order in the snapshot,
 * but database row ordering cannot turn a retry into a different intent. */
export function canonicalExecutionOutcomes(outcomes: ExecutionSpec['outcomes']) {
  return outcomes.toSorted((left, right) => left.id.localeCompare(right.id)).map(outcome => ({ ...outcome,
    bindings: outcome.bindings.toSorted((left, right) => left.key.localeCompare(right.key)),
  }))
}

export function executionIntentHash(spec: ExecutionSpec) {
  // Depth and verification scopes are derived at admission, not by this
  // command's caller. Both ledgers retain that snapshot; replay identity remains
  // the requested target, checks, explicit bindings, revisions and verification
  // intent. A broad caller selects the Site, not its automatically derived bindings.
  return createHash('sha256').update(canonicalIntent({ ...spec, outcomes: spec.scope === 'SITE' || spec.scope === 'CATEGORY' ? [] : canonicalExecutionOutcomes(spec.outcomes),
    targetUrl: spec.category ? undefined : spec.targetUrl,
    category: spec.category ? { area: spec.category.area } : undefined,
    reviewDepth: undefined, verificationScopes: undefined, consoleObservationMs: undefined, consoleObservationScopes: undefined })).digest('hex')
}
