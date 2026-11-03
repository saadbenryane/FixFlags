import { createHash } from 'node:crypto'
import type { SiteFlagDetail } from './flags'
import { boardFlagPrompt } from './board-card'
import { hasRepairGuidance, resolveRepairDefinition } from '@/lib/improvements/repair-guidance'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { AGENT_HANDOFF_COPY as C } from '@/lib/marketing/copy/agent-handoff'
import { canonicalIntent } from './domain/execution-spec'
import { repairBriefSchema, repairObservationOffsetSchema, REPAIR_OBSERVATIONS_PER_PAGE } from './repair-brief-contract'
import { readSupportingObservationView } from '@/lib/audit/flag-observations'
import { SiteRunRefusal } from './application/run-refusal'
import { MAX_REPAIR_BRIEF_BYTES, MAX_REPAIR_PROMPT_BYTES } from './repair-budgets'

/** Explicit customer-safe projection, shared by copied tasks, HTTP and MCP. */
export function buildSiteRepairBrief(siteId: string, flag: SiteFlagDetail, appUrl: string,
  referenceFlagId = flag.sourceFlagId ?? flag.id, observationOffset = 0, expectedContextHash?: string) {
  const base = appUrl.replace(/\/$/, '')
  const sourceFlagId = flag.sourceFlagId ?? flag.id
  const scope = `/sites/${encodeURIComponent(siteId)}/flags/${encodeURIComponent(referenceFlagId)}`
  const observations = flag.supportingObservations == null ? [] : readSupportingObservationView(flag.supportingObservations)
  const unreadable = Boolean(flag.supportingEvidenceUnreadable || observations === null)
  const total = unreadable ? null : observations!.length
  if (!repairObservationOffsetSchema.safeParse(observationOffset).success)
    throw new SiteRunRefusal('Choose a valid supporting observation page.', 400, 'INVALID_OBSERVATION_PAGE')
  const definition = unreadable ? resolveRepairDefinition({ ...flag, supportingEvidenceUnreadable: true })
    : flag.repairDefinition ?? resolveRepairDefinition(flag)
  const ready = Boolean(definition && hasRepairGuidance(definition.guidance))
  const context = {
    schemaVersion: 'fixflags.repair-brief.v1' as const,
    siteId,
    referenceFlagId,
    flag: {
      flagId: flag.id, sourceFlagId, sourceAuditId: flag.sourceAuditId,
      checkId: flag.checkId, status: flag.status, verificationState: flag.verificationState,
      severity: flag.severity, area: flag.area,
      problem: flag.problem, whyItMatters: flag.whyItMatters,
      pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths,
      outcomeId: flag.outcomeId, outcomeName: flag.relatedOutcome?.name ?? null,
      evidence: unreadable || flag.evidenceMissing ? null : flag.evidence,
      evidenceContext: flag.evidenceContext ?? null,
      supportingObservations: unreadable ? null : observations,
      viewport: flag.viewport, confidence: flag.confidence, causeCertainty: flag.causeCertainty,
      latestOccurrenceAt: flag.latestOccurrenceAt ?? null,
    },
    repair: {
      readiness: ready ? 'ready' as const : !unreadable && flag.repairGuidance === 'pending' ? 'pending' as const : 'unavailable' as const,
      guidance: ready ? definition!.guidance : null,
      ...(ready ? { definition: definition! } : {}),
    },
    verification: {
      expectedBehavior: flag.expectedBehavior, rule: flag.verificationRule,
      independentCheckRequired: true,
      afterDeployment: {
        tool: MCP_TOOLS.recordFix.name, arguments: { siteId, flagId: referenceFlagId },
        requiredChangeContext: ['idempotencyKey', 'changeSummary'], optionalChangeContext: ['commit', 'deployment'],
        continuation: 'Follow the returned next instruction until verification completes or fails.',
      },
    },
    limitations: [
      ...(flag.evidenceMissing ? [C.missingEvidence] : []),
      ...(unreadable ? [C.unreadableEvidence] : []),
      ...(!flag.verificationRule ? [C.missingRule] : []),
    ],
    instructions: C.instructions,
  }
  // Bind the handoff to its actual evidence and guidance, not a mutable URL.
  const { status: _status, verificationState: _verificationState, latestOccurrenceAt: _latestOccurrenceAt, ...recordedFlag } = context.flag
  void _status; void _verificationState; void _latestOccurrenceAt
  const contextHash = createHash('sha256').update(canonicalIntent({
    schemaVersion: context.schemaVersion, siteId, referenceFlagId,
    sourceFlagIds: flag.sourceFlagIds?.toSorted(),
    flag: { ...recordedFlag, flagId: referenceFlagId,
      supportingObservations: observations?.map(item => createHash('sha256').update(canonicalIntent(item)).digest('hex')) ?? null }, repair: context.repair,
    verification: { expectedBehavior: context.verification.expectedBehavior, rule: context.verification.rule },
  })).digest('hex')
  if (expectedContextHash && expectedContextHash !== contextHash)
    throw new SiteRunRefusal(C.changed, 409, 'REPAIR_CONTEXT_CHANGED')
  if (observationOffset > (total ?? 0))
    throw new SiteRunRefusal('Choose a valid supporting observation page.', 400, 'INVALID_OBSERVATION_PAGE')
  let page = unreadable ? null : observations!.slice(observationOffset, observationOffset + REPAIR_OBSERVATIONS_PER_PAGE)
  const jsonUrl = (offset: number) => `${base}/api${scope}/repair-brief?contextHash=${contextHash}${offset ? `&observationOffset=${offset}` : ''}`
  const request = (offset: number) => ({ tool: MCP_TOOLS.getFlag.name, arguments: { siteId, flagId: referenceFlagId,
    expectedContextHash: contextHash, ...(offset ? { observationOffset: offset } : {}) } })
  const result = () => {
    const nextOffset = total !== null && observationOffset + (page?.length ?? 0) < total ? observationOffset + (page?.length ?? 0) : null
    const links = {
      flag: `${base}${scope}`,
      report: flag.sourceAuditId ? `${base}/report/${encodeURIComponent(flag.sourceAuditId)}` : null,
      json: jsonUrl(observationOffset), next: nextOffset === null ? null : jsonUrl(nextOffset), evidence: `${jsonUrl(0)}&includeEvidence=true`,
    }
    return repairBriefSchema.parse({ ...context, flag: { ...context.flag, supportingObservations: page }, contextHash, links,
      verification: { ...context.verification, afterDeployment: { ...context.verification.afterDeployment,
        arguments: { ...context.verification.afterDeployment.arguments, expectedContextHash: contextHash } } },
      observationPage: { offset: observationOffset, returned: page?.length ?? 0, total, nextOffset,
        complete: total !== null && observationOffset === 0 && page?.length === total },
      retrieval: { mcp: request(observationOffset), next: nextOffset === null ? null : request(nextOffset),
        evidence: { ...request(0), arguments: { ...request(0).arguments, includeEvidence: true } }, authentication: 'owner-session-or-developer-key' } })
  }
  let brief = result()
  while (Buffer.byteLength(JSON.stringify(brief)) > MAX_REPAIR_BRIEF_BYTES && page && page.length > 1) {
    page = page.slice(0, -1)
    brief = result()
  }
  if (Buffer.byteLength(JSON.stringify(brief)) > MAX_REPAIR_BRIEF_BYTES)
    throw new SiteRunRefusal(C.evidenceTooLarge, 422, 'REPAIR_CONTEXT_TOO_LARGE')
  return brief
}

/** Render the same validated task for a single copy or a composed repair session. */
export function buildSiteRepairHandoff(...args: Parameters<typeof buildSiteRepairBrief>) {
  const brief = buildSiteRepairBrief(...args)
  const { flag, repair, verification, links, contextHash } = brief
  const recordedTask = repair.readiness === 'ready' && repair.guidance ? boardFlagPrompt({
    problem: flag.problem, whyItMatters: flag.whyItMatters, evidence: flag.evidence,
    actionLabel: repair.definition?.kind === 'repair' ? 'Fix' : 'Next step',
    fix: repair.guidance, pageUrl: flag.pageUrl, affectedPaths: flag.affectedPaths,
    journeyName: flag.outcomeName, expectedBehavior: verification.expectedBehavior,
    supportingObservations: flag.supportingObservations,
  }) : ''
  const references = [
    `FixFlags repair brief (${brief.schemaVersion})`,
    `Flag: ${flag.sourceFlagId}. Source scan: ${flag.sourceAuditId}. Context revision: ${contextHash}.`,
    `Flag details: ${links.flag}`,
    links.report ? `Recorded scan: ${links.report}` : null,
    `Agent-readable repair JSON: ${links.json}`,
    `MCP: ${JSON.stringify(brief.retrieval.mcp)}`,
  ]
  const task = [
    !brief.observationPage.complete && brief.observationPage.total !== null
      ? C.remainingObservations(brief.observationPage.returned, brief.observationPage.total) : null,
    recordedTask,
    repair.readiness === 'ready' && repair.definition ? [
      C.definition(repair.definition.kind, repair.definition.source, repair.definition.recipeVersion, repair.definition.recipeCheckVersion),
      ...repair.definition.preconditions.map(C.precondition),
      ...repair.definition.acceptance.map(C.acceptance),
    ].join('\n') : null,
    verification.rule ? `Recorded verification rule: ${verification.rule}` : null,
    ...brief.limitations,
  ]
  const prompt = recordedTask ? [...references, C.retrieval,
    ...C.instructions.map((instruction, index) => `${index + 1}. ${instruction}`), ...task].filter(Boolean).join('\n\n') : null
  if (prompt && Buffer.byteLength(prompt) > MAX_REPAIR_PROMPT_BYTES)
    throw new SiteRunRefusal(C.taskTooLarge, 422, 'REPAIR_CONTEXT_TOO_LARGE')
  // Bundles keep per-Flag references and evidence, with shared instructions once.
  const bundlePrompt = recordedTask ? [...references, ...task].filter(Boolean).join('\n\n') : null
  return { brief, prompt, bundlePrompt, promptHash: prompt ? createHash('sha256').update(prompt).digest('hex') : null }
}
