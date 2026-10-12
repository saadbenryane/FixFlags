import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { trackingPageKey } from '@/lib/audit/tracking/identity'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { validateBindingForOutcome } from './binding-config'
import { canonicalIntent, executionSpecSchema, type ExecutionSpec } from '../domain/execution-spec'

type SpecOutcome = { id: string; kind: string; expectation?: string | null; bindingPolicy?: string;
  bindings: Array<{ key: string; version: number; mechanism: string; required: boolean; config: Prisma.JsonValue; scope?: Prisma.JsonValue | null }> }

export async function buildExecutionSpec(input: { projectId: string; targetUrl: string; environment: string;
  scope: ExecutionSpec['scope']; outcomes: SpecOutcome[]; verificationTarget?: ExecutionSpec['verificationTarget'] }): Promise<ExecutionSpec> {
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
  const diagnosticModule = input.verificationTarget?.kind === 'DIAGNOSTIC' ? CHECK_REGISTRY[input.verificationTarget.checkId.split('::page:')[0]]?.module : null
  if (input.verificationTarget?.kind === 'DIAGNOSTIC' && ['measurement', 'auth-checkout', 'og-image', 'form-validation'].includes(diagnosticModule ?? '')) {
    const flags = await prisma.flag.findMany({ where: { auditId: input.verificationTarget.parentAuditId,
      audit: { projectId: input.projectId }, pageUrl: input.verificationTarget.pageUrl,
      checkId: input.verificationTarget.checkId }, take: 100, select: { evidenceTargets: true, affectedPaths: true } })
    const contexts = flags.flatMap(flag => Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.flatMap(value => {
      const context = value && typeof value === 'object' && !Array.isArray(value) ? value.context : null
      return typeof context === 'string' && context.startsWith('tracking:') && context.length <= 4200 ? [context] : []
    }) : [])
    const pages = [...new Map([input.verificationTarget.pageUrl, ...flags.flatMap(flag => Array.isArray(flag.affectedPaths) ? flag.affectedPaths.filter((page): page is string => typeof page === 'string') : [])].map(page => [trackingPageKey(page), page])).values()]
    verificationScopes = pages.map(pageUrl => ({ pageUrl, phases: diagnosticModule !== 'measurement' ? ['page_load'] : (['page_load', 'public_action'] as const).filter(phase =>
      contexts.some(context => context.startsWith('tracking:' + phase + ':') && context.endsWith(':page:' + trackingPageKey(pageUrl)))) }))

  }
  return executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', targetUrl: input.targetUrl, environment: input.environment,
    scope: input.scope, checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, definition]) => [id, definition.version])),
    outcomes, verificationTarget: input.verificationTarget ?? null, ...(verificationScopes ? { verificationScopes } : {}) })
}

export function executionIntentHash(spec: ExecutionSpec) {
  // Depth and verification scopes are derived at admission, not by this
  // command's caller. Both ledgers retain that snapshot; replay identity remains
  // the requested target, checks, bindings, revisions and verification intent.
  return createHash('sha256').update(canonicalIntent({ ...spec, reviewDepth: undefined, verificationScopes: undefined })).digest('hex')
}
