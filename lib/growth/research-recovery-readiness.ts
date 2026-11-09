import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { hasUncoveredScheduledRecoveryReceipt, readOutcomeRecoveryEvidence } from '@/lib/analytics/outcome-recovery-query'
import { summarizeOutcomeRecoveryEvidence, type OutcomeObservation } from '@/lib/analytics/outcome-recovery-value'
import { MIN_PUBLIC_RESEARCH_SITES } from '@/lib/graph/public-research'
import { DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
import { researchPublicTargetMatchesSite } from './research-sources'
import type { ResearchIndependenceSource } from './research-independence'

export type ResearchRecoverySource = ResearchIndependenceSource & {
  siteUrl: string
  earliestRequestAt: Date
}

const publicAvailability = z.object({
  scope: z.null().optional(),
  bindings: z.tuple([z.object({
    key: z.string().min(1),
    version: z.number().int().positive(),
    result: z.enum(['FAILED', 'SUCCEEDED']),
    mechanism: z.literal('HTTP_AVAILABILITY'),
    evaluator: z.literal(DEFAULT_AVAILABILITY_EVALUATOR),
    config: z.strictObject({ startUrl: z.url(), expectedSelector: z.literal('body').optional() }),
    scope: z.null().optional(),
    fixture: z.undefined().optional(),
  })]),
})

const observedAvailability = z.object({
  url: z.url(), finalUrl: z.url(), publicHttpFinalUrl: z.url().nullish(), collectedAt: z.iso.datetime(),
  evaluator: z.literal(DEFAULT_AVAILABILITY_EVALUATOR),
  source: z.enum(['public-http', 'rendered-navigation', 'public-http-and-rendered-dom']),
})
const attemptsSchema = z.array(z.object({ disposition: z.enum(['FAILED', 'SUCCEEDED']), scope: observedAvailability })).min(1).max(2)
const PROOF_LIMIT = 5000
const availabilityScopeSql = (detail: Prisma.Sql) => Prisma.sql`jsonb_build_object(
  'url', ${detail}->'url', 'finalUrl', ${detail}->'finalUrl', 'publicHttpFinalUrl', ${detail}->'publicHttpFinalUrl',
  'collectedAt', ${detail}->'collectedAt', 'evaluator', ${detail}->'evaluator', 'source', ${detail}->'source')`

async function readAvailabilityProof(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, auditIds: string[]) {
  const rows = auditIds.length ? await tx.$queryRaw<Array<{
    auditId: string; outcomeId: string; bindingKey: string; bindingVersion: number | null;
    disposition: string; failureFlagId: string | null; scope: unknown; attempts: unknown;
  }>>`
    SELECT execution."auditId", execution."outcomeId", execution."bindingKey", execution."bindingVersion",
      execution.disposition::text, execution.detail->>'failureFlagId' AS "failureFlagId",
      ${availabilityScopeSql(Prisma.sql`execution.detail`)} AS scope, history.attempts
    FROM outcome_binding_executions execution
    CROSS JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('disposition', attempt.disposition, 'scope', attempt.scope)
        ORDER BY attempt.attempt) AS attempts
      FROM (
        SELECT stored.attempt, stored.disposition, ${availabilityScopeSql(Prisma.sql`stored.detail`)} AS scope
        FROM outcome_binding_attempts stored WHERE stored."executionId" = execution.id
          AND stored."auditId" = execution."auditId" AND stored."outcomeId" = execution."outcomeId"
          AND stored."bindingKey" = execution."bindingKey" AND stored."bindingVersion" = execution."bindingVersion"
          AND stored."executionGeneration" IS NOT DISTINCT FROM execution."executionGeneration"
          AND stored.mechanism = execution.mechanism
        LIMIT 3
      ) AS attempt
    ) AS history
    WHERE execution."auditId" = ANY(${auditIds}::text[]) AND execution.mechanism = 'HTTP_AVAILABILITY'
      AND execution.disposition IN ('FAILED', 'SUCCEEDED')
    LIMIT ${PROOF_LIMIT + 1}
  ` : []
  if (rows.length > PROOF_LIMIT) throw new Error('Availability research proof exceeds reporting limit')
  return new Map(rows.map(row => [JSON.stringify([row.auditId, row.outcomeId, row.bindingKey]), row]))
}

/** Count native recovery only for the consented public availability method. */
export async function readResearchRecoveryCandidate(tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  window: { start: Date; end: Date }, sources: ReadonlyMap<string, ResearchRecoverySource>, groups: ReadonlyMap<string, string>,
  { requireScheduledCoverage = false } = {}) {
  const retained = await readOutcomeRecoveryEvidence(tx, {
    since: window.start, now: window.end, availabilityAuditIds: [...sources.keys()],
  })
  const evidence = await readAvailabilityProof(tx, [...new Set(retained.observations.map(row => row.auditId))])
  function eligibleHostname(row: OutcomeObservation) {
    const source = sources.get(row.auditId)
    if (!source || row.requestedAt < source.earliestRequestAt) return undefined
    const coverage = publicAvailability.safeParse(row.coverage)
    if (!coverage.success) return undefined
    const binding = coverage.data.bindings[0]
    if (!researchPublicTargetMatchesSite(source.siteUrl, binding.config.startUrl)) return undefined
    const proof = evidence.get(JSON.stringify([row.auditId, row.outcomeId, binding.key]))
    if (!proof || proof.bindingVersion !== binding.version || proof.disposition !== binding.result ||
      ('flagId' in row && proof.failureFlagId !== row.flagId)) return undefined
    const attempts = attemptsSchema.safeParse(proof.attempts)
    const conclusive = observedAvailability.safeParse(proof.scope)
    if (!attempts.success || !conclusive.success) return undefined
    const last = attempts.data.at(-1)!
    if (last.disposition !== binding.result || JSON.stringify(last.scope) !== JSON.stringify(conclusive.data) ||
      (binding.result === 'FAILED' && attempts.data.length !== 2) ||
      (attempts.data.length === 2 && attempts.data[0].disposition !== 'FAILED')) return undefined
    const requestedUrl = new URL(binding.config.startUrl).href
    let collectedAfter = row.requestedAt.getTime()
    for (const { scope, disposition } of attempts.data) {
      const observedAt = Date.parse(scope.collectedAt)
      const httpInScope = scope.publicHttpFinalUrl ? researchPublicTargetMatchesSite(source.siteUrl, scope.publicHttpFinalUrl)
        : scope.source === 'public-http'
      if (!Number.isFinite(observedAt) || observedAt < collectedAfter || observedAt > row.completedAt.getTime() ||
        new URL(scope.url).href !== requestedUrl || !httpInScope ||
        !researchPublicTargetMatchesSite(source.siteUrl, scope.finalUrl) ||
        (disposition === 'SUCCEEDED' && scope.source !== 'public-http-and-rendered-dom')) return undefined
      collectedAfter = observedAt
    }
    return source.hostname
  }
  const observations = Map.groupBy(retained.observations, eligibleHostname)
  const failures = Map.groupBy(retained.failures, eligibleHostname)
  let recoveredSites = 0
  const recoveredGroups = new Set<string>()
  const matureFollowupGroups = new Set<string>()
  const comparableFollowupGroups = new Set<string>()
  const failureAfterPassGroups = new Set<string>()
  const recoveryWindows = new Map<OutcomeObservation, Date>()
  const eligibleScheduledReceipts: Array<{ runRequestId: string; outcomeId: string }> = []
  for (const [host, rows] of observations) {
    const group = groups.get(rows[0].auditId)
    if (!host || group === undefined) continue
    const { report: { counts }, matureRecoveryWindows } = summarizeOutcomeRecoveryEvidence({ since: window.start, now: window.end,
      observations: rows, failures: failures.get(host) ?? [] })
    if (requireScheduledCoverage) {
      for (const [recovery, end] of matureRecoveryWindows) recoveryWindows.set(recovery, end)
      for (const { source, runRequestId, outcomeId } of rows) {
        if (source === 'WATCH') eligibleScheduledReceipts.push({ runRequestId, outcomeId })
      }
    }
    if (counts.verifiedRecoveredFlags) {
      recoveredSites++
      recoveredGroups.add(group)
    }
    if (counts.matureRecoveredFlags) matureFollowupGroups.add(group)
    if (counts.firstComparablePass || counts.firstComparableFailure) comparableFollowupGroups.add(group)
    if (counts.comparableFailureAfterScheduledPass) failureAfterPassGroups.add(group)
  }
  if (recoveredGroups.size < MIN_PUBLIC_RESEARCH_SITES) return null
  const uncovered = requireScheduledCoverage &&
    await hasUncoveredScheduledRecoveryReceipt(tx, recoveryWindows, eligibleScheduledReceipts)
  return {
    evaluator: DEFAULT_AVAILABILITY_EVALUATOR,
    recoveredSites,
    matureFollowupMeetsMinimum: matureFollowupGroups.size >= MIN_PUBLIC_RESEARCH_SITES,
    comparableFollowupMeetsMinimum: uncovered ? null : comparableFollowupGroups.size >= MIN_PUBLIC_RESEARCH_SITES,
    failureAfterScheduledPassMeetsMinimum: uncovered ? null : failureAfterPassGroups.size >= MIN_PUBLIC_RESEARCH_SITES,
  }
}
