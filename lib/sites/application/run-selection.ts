import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { categoryAreaSchema } from '../domain/execution-spec'
import { buildExecutionSpec,executionIntentHash } from './execution-spec'
import type { RunInput } from './run-intent'
import { SiteRunRefusal } from './run-refusal'
import { snapshotOutcomeAuthorization } from '../domain/outcome-authorization'

export function validateRunSelection(input: RunInput) {
  const selectedIds = [...new Set(input.outcomeIds)].sort()
  const scope = input.scope ?? 'OUTCOMES'
  const environment = input.environment ?? 'production'
  if (scope === 'CATEGORY' ? !categoryAreaSchema.safeParse(input.categoryArea).success || input.source === 'WATCH' : input.categoryArea !== undefined)
    throw new SiteRunRefusal('Invalid category check selection', 400)
  if (scope === 'CATEGORY' && (input.url || input.parentAuditId)) throw new SiteRunRefusal('Category checks use the latest website inventory.', 400)
  if ((scope === 'FIXTURE_SETUP') !== Boolean(input.fixtureId) ||
    scope === 'FIXTURE_SETUP' && (selectedIds.length > 0 || input.verificationTarget))
    throw new SiteRunRefusal('Invalid Signup setup selection', 400)
  if ((scope === 'SITE' || scope === 'CATEGORY' || scope === 'ACCOUNT_CHECKS') && (selectedIds.length > 0 || input.verificationTarget)) {
    throw new SiteRunRefusal('Site care cannot select an Outcome or Flag verification target', 400)
  }
  if (scope === 'OUTCOMES' && selectedIds.length === 0 && input.verificationTarget?.kind !== 'DIAGNOSTIC') {
    throw new SiteRunRefusal('Select at least one Outcome', 400)
  }
  if (
    input.verificationTarget?.kind === 'OUTCOME' &&
    !selectedIds.includes(input.verificationTarget.outcomeId)
  ) {
    throw new SiteRunRefusal('Verification target must be included in the Outcome selection', 400)
  }
  return { scope, environment, selectedIds }
}

export async function resolveRunExecution(input: RunInput, selection: ReturnType<typeof validateRunSelection>) {
  const { scope, environment } = selection
  const cleanup = Boolean(input.operator && scope === 'ACCOUNT_CHECKS' && input.accountMode === 'cleanup')
  let { selectedIds } = selection
  const outcomes = await prisma.siteOutcome.findMany({
    where: {
      ...(scope === 'SITE' || scope === 'CATEGORY' && input.categoryArea === 'conversion' ? { environment,
        ...(scope === 'CATEGORY' ? { kind: { not: 'AVAILABILITY' as const } } : {}),
        bindings: { some: { enabled: true, required: true } } } : { id: { in: selectedIds } }),
      projectId: input.projectId,
      enabled: true,
      project: { userId: input.userId, ...(cleanup ? {} : { deletedAt: null }) },
    },
    include: {
      project: { select: { url: true } },
      bindings: {
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (scope === 'SITE' || scope === 'CATEGORY') selectedIds = outcomes.map(outcome => outcome.id).sort()
  else if (outcomes.length !== selectedIds.length) throw new SiteRunRefusal('Outcome not found', 404)
  if (outcomes.some((outcome) => outcome.environment !== environment)) {
    throw new SiteRunRefusal('Outcome is not configured for this environment', 400)
  }
  const first = outcomes.find((outcome) => outcome.id === selectedIds[0]) ?? null
  const project = first?.project ?? await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId, ...(cleanup ? {} : { deletedAt: null }) },
    select: { url: true },
  })
  if (!project) throw new SiteRunRefusal('Site not found', 404)

  const fixture = input.fixtureId ? await prisma.outcomeFixture.findFirst({
    where: { id: input.fixtureId, projectId: input.projectId, enabled: true }, select: { id: true, version: true, targetUrl: true },
  }) : null
  if (input.fixtureId && !fixture) throw new SiteRunRefusal('Signup fixture not found', 404)

  const single = outcomes.length === 1 ? outcomes[0] : null
  const singleRequired = single?.bindings.filter((binding) => binding.required) ?? []
  const singleConfig = singleRequired.length === 1 ? singleRequired[0]!.config as Record<string, unknown> : null
  const singleStart = typeof singleConfig?.startUrl === 'string' ? singleConfig.startUrl : null
  // Watch and multi-Outcome runs enter at the Site. One bound Outcome can
  // start at its own page. Each binding still executes from its own config.
  const requestedUrl = fixture?.targetUrl ?? (input.verificationTarget?.kind === 'DIAGNOSTIC'
    ? input.verificationTarget.pageUrl
    : input.url ?? (scope === 'SITE' || scope === 'CATEGORY' || input.source === 'WATCH' || !singleStart ? project.url : singleStart))
  const normalized = normalizeAuditUrl(requestedUrl)
  const auditUrl = normalized.ok ? normalized.url : requestedUrl
  const executionSpec = fixture ? { version: 1 as const, engine: 'progressive-v1' as const, targetUrl: auditUrl, environment,
    scope: 'FIXTURE_SETUP' as const, fixtureSetup: { id: fixture.id, version: fixture.version }, checks: {}, outcomes: [], verificationTarget: null } : await buildExecutionSpec({
    projectId: input.projectId, targetUrl: auditUrl, environment,
    scope: input.verificationTarget?.kind === 'DIAGNOSTIC' ? 'DIAGNOSTIC' : scope,
    outcomes, categoryArea: input.categoryArea, accountMode: input.accountMode, verificationTarget: input.verificationTarget,
  })
  if (scope === 'ACCOUNT_CHECKS' && !executionSpec.accountChecks) throw new SiteRunRefusal('Automatic account checks are paused or unavailable.', 409)
  const requestHash = executionIntentHash(executionSpec)
  if (executionSpec.scope === 'DIAGNOSTIC' || executionSpec.scope === 'CATEGORY') {
    try { initialTaskPlan(executionSpec) }
    catch { throw new SiteRunRefusal(executionSpec.scope === 'CATEGORY' ? 'This category has no valid execution plan.' : 'This finding has no registered independent verifier. Its previous evidence is retained; a repair cannot be certified by this action.', 409) }
  }
  return { selectedIds, first, fixture, auditUrl, executionSpec, requestHash,
    outcomeAuthorization: snapshotOutcomeAuthorization(outcomes) }
}
