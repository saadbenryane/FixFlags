import { hasCurrentOutcomeSuccess } from '../domain/outcome-evaluation'
import { Prisma, type OutcomeAssessment } from '@prisma/client'
import { currentExecutionOwnership, executionTransaction, lockExecutionScope } from '@/lib/audit/execution-ownership'
import { outcomeFlagFingerprint, outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { newestRecordedFlag } from '@/lib/sites/flag-resolution'
import { checkoutScopeGaps, comparableOutcomeCoverage, recordedCheckoutFailureScope, recordedOutcomeBindingResults, type CheckoutScopeGap } from '../domain/outcome-proof'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { historicalCheckoutCaptureJoin, withHistoricalCheckoutDestination, type HistoricalCheckoutCapture } from './checkout-capture'
import { checkoutFailureHistory } from './checkout-failure-history'
import { outcomeIncidentTransition, readOutcomeIncident, readOutcomeRecovery } from '../domain/outcome-incident'
import { readExecutionSpec } from '../domain/execution-spec'
import { lockAdminSiteOperation, type AdminSiteOperationScope } from '@/lib/admin/domain-actor'
import { outcomeReceiptJoins, supersededOutcomeReceiptSql } from './outcome-receipt-sql'
import { improvementProposal } from '@/lib/improvements/occurrences'
import { lockImprovementLedger } from '@/lib/improvements/ledger-lock'

type AssessmentInput = Prisma.OutcomeAssessmentUncheckedCreateInput & {
  projectId: string; bindingKeys: string[]; failureFlagIds: string[]; legacyFailureFlagId?: string; outcomeKind: string
}

/** One fenced projection owns assessment, incident continuity and recovered Flags.
 * Append-only assessments retain their decision even if finalization is retried. */
export async function persistOutcomeAssessment(input: AssessmentInput, authority?: AdminSiteOperationScope) {
  const { projectId, bindingKeys, failureFlagIds, legacyFailureFlagId, outcomeKind, ...assessment } = input
  const owner = currentExecutionOwnership()
  if (owner && owner.auditId !== input.auditId) throw new Error('Outcome assessment has no matching Site request')
  return executionTransaction(async tx => {
    if (authority) await lockAdminSiteOperation(authority, tx, input.auditId)
    if (!authority && !owner && !await lockExecutionScope(tx, input.auditId))
      throw new Error('Outcome assessment has no matching Site request')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:outcome-incident:${input.outcomeId}`}, 0))`
    const request = await tx.runRequest.findFirst({ where: { id: input.runRequestId, projectId, auditId: input.auditId,
      audit: { projectId }, selections: { some: { outcomeId: input.outcomeId, outcome: { projectId } } },
    }, select: { requestedAt: true, executionSpec: true } })
    if (!request || request.executionSpec != null &&
      !readExecutionSpec(request.executionSpec)?.outcomes.some(outcome => outcome.id === input.outcomeId))
      throw new Error('Outcome assessment has no matching Site request')
    const existing = await tx.outcomeAssessment.findUnique({ where: { runRequestId_outcomeId: {
      runRequestId: input.runRequestId, outcomeId: input.outcomeId } } })
    if (existing && existing.auditId !== input.auditId) throw new Error('Outcome assessment has no matching Audit')
    if (existing) return existing
    const historyScope = Prisma.sql`request."projectId" = ${projectId} AND source."outcomeId" = ${input.outcomeId}`
    const [superseding] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT source.id FROM outcome_assessments source ${outcomeReceiptJoins}
      WHERE ${historyScope} AND request.id <> ${input.runRequestId} AND request."requestedAt" >= ${request.requestedAt}
      LIMIT 1`
    const currentFlags = failureFlagIds.length ? await tx.flag.findMany({ where: { id: { in: failureFlagIds }, auditId: input.auditId,
      audit: { projectId }, fingerprint: { in: bindingKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key)) } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, fingerprint: true, status: true, problem: true, whyItMatters: true, fix: true, pageUrl: true, verificationRule: true,
        improvementOccurrence: { select: { auditId: true, improvement: { select: { id: true, projectId: true, outcomeId: true, fingerprint: true } } } },
      } }) : []
    const boundImprovements = new Map<string, (typeof currentFlags)[number]>()
    for (const flag of currentFlags) {
      const occurrence = flag.improvementOccurrence, improvement = occurrence?.improvement
      if (occurrence?.auditId !== input.auditId || !improvement || improvement.projectId !== projectId ||
        improvement.fingerprint !== flag.fingerprint || improvement.outcomeId && improvement.outcomeId !== input.outcomeId) continue
      if (!boundImprovements.has(improvement.id)) boundImprovements.set(improvement.id, flag)
    }
    const legacy = !currentFlags.length && input.state === 'FLAG' && legacyFailureFlagId
      ? await tx.improvementOccurrence.findUnique({ where: { flagId: legacyFailureFlagId, auditId: input.auditId, audit: { projectId },
          improvement: { projectId, OR: [{ outcomeId: null }, { outcomeId: input.outcomeId }] } },
        select: { improvementId: true } }) : null
    const assessedAt = new Date(input.assessedAt ?? Date.now())
    const previous = await tx.$queryRaw<OutcomeAssessment[]>`
      SELECT source.* FROM outcome_assessments source ${outcomeReceiptJoins}
      WHERE ${historyScope} AND source."auditId" <> ${input.auditId}
        AND source.state IN ('CLEAR', 'FLAG') AND NOT (${supersededOutcomeReceiptSql})
        AND source."assessedAt" <= ${assessedAt} AND request."requestedAt" < ${request.requestedAt}
      ORDER BY request."requestedAt" DESC, source."assessedAt" DESC, source.id DESC LIMIT 50`
    let before = previous.find(row => comparableOutcomeCoverage(row.coverage, input.coverage) &&
      (row.state !== 'CLEAR' || hasCurrentOutcomeSuccess(outcomeKind, row.coverage))) ?? null
    if (before?.state === 'FLAG' && before.improvementId && !readOutcomeIncident(before.evidence) && bindingKeys.length === 1) {
      const sourceRun = await tx.runRequest.findUnique({ where: { id: before.runRequestId }, select: {
        executionSpec: true, selections: { select: { outcomeId: true } },
      } })
      const sourceFlags = await tx.flag.findMany({ where: { auditId: before.auditId, audit: { projectId },
        improvementOccurrence: { improvementId: before.improvementId }, checkId: { not: null } }, take: 2, select: { id: true, status: true } })
      const version = (input.coverage as { bindings?: Array<{ version?: number }> })?.bindings?.[0]?.version
      const sourceExecution = await tx.outcomeBindingExecution.findFirst({ where: { auditId: before.auditId,
        outcomeId: input.outcomeId, bindingKey: bindingKeys[0], disposition: 'FAILED', bindingVersion: version ?? -1 }, select: { id: true } })
      const sourceSpec = readExecutionSpec(sourceRun?.executionSpec)
      const unambiguous = sourceSpec ? sourceSpec.outcomes.filter(item => item.kind === outcomeKind).length === 1 &&
        sourceSpec.outcomes.some(item => item.id === input.outcomeId && item.kind === outcomeKind)
        : sourceRun?.selections.length === 1 && sourceRun.selections[0].outcomeId === input.outcomeId
      if (unambiguous && sourceFlags.length === 1 &&
        sourceExecution && sourceFlags[0].status !== 'FIXED') {
        const evidence = before.evidence && typeof before.evidence === 'object' && !Array.isArray(before.evidence) ? before.evidence : {}
        before = { ...before, evidence: { ...evidence, incident: { version: 1, transition: 'failure',
          incidentRunRequestId: before.runRequestId, rootFlagIds: [sourceFlags[0].id], flagIds: [sourceFlags[0].id], recoveredFlagIds: [], previousAssessmentId: null } } }
      }
    }
    const incident = outcomeIncidentTransition({ state: input.state, coverage: input.coverage, evidence: input.evidence,
      runRequestId: input.runRequestId, flagIds: currentFlags.map(flag => flag.id), previous: before })
    // A superseded observation remains part of its run's history, but cannot
    // recover or reclassify the current incident or emit a recovery transition.
    if (superseding && ['recovery', 'regression'].includes(incident.transition)) {
      incident.transition = input.state === 'CLEAR' ? 'clear' : 'failure'
      incident.recoveredFlagIds = []
    }
    if (input.state === 'FLAG' && (boundImprovements.size || legacy)) {
      const ids = legacy ? [legacy.improvementId] : [...boundImprovements.keys()].sort()
      for (const id of ids) await lockImprovementLedger(tx, id)
      await tx.improvement.updateMany({ where: { id: { in: ids }, projectId, outcomeId: null }, data: { outcomeId: input.outcomeId } })
      if (!superseding) for (const [id, flag] of boundImprovements) {
        if (flag.status !== 'OPEN' && flag.status !== 'REGRESSED') continue
        const owned = { id, projectId, outcomeId: input.outcomeId }
        await tx.improvement.updateMany({ where: owned, data: improvementProposal(flag) })
        await tx.improvement.updateMany({ where: { ...owned, status: 'VERIFIED' }, data: { status: 'PROPOSED' } })
      }
    }
    const bindingResults = bindingKeys.length > 1 ? recordedOutcomeBindingResults(input.coverage, outcomeKind) : null
    const passingKeys = incident.transition === 'recovery' ? bindingKeys : bindingKeys.filter(key => bindingResults?.get(key) === 'SUCCEEDED')
    const incidentMembers = Prisma.sql`
      SELECT source."auditId", member.id, source.id AS "assessmentId"
      FROM outcome_assessments source ${outcomeReceiptJoins}
      CROSS JOIN LATERAL jsonb_array_elements_text(CASE
        WHEN jsonb_typeof(source.evidence #> '{incident,flagIds}') = 'array'
        THEN source.evidence #> '{incident,flagIds}' ELSE '[]'::jsonb END) AS member(id)
      WHERE ${historyScope} AND source.state = 'FLAG' AND NOT (${supersededOutcomeReceiptSql})
        AND source.evidence #>> '{incident,incidentRunRequestId}' = ${incident.incidentRunRequestId}
        AND request."requestedAt" < ${request.requestedAt}
    `
    let checkoutGaps: string[] = []
    let checkoutGapReason: CheckoutScopeGap | undefined
    if (!superseding && before?.state === 'FLAG' && incident.incidentRunRequestId && passingKeys.length) {
      const fingerprints = passingKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key))
      const openFlags = await tx.$queryRaw<Array<{ id: string; improvementId: string | null; fingerprint: string | null;
        createdAt: Date; coverage: Prisma.JsonValue | null; capture: HistoricalCheckoutCapture | null }>>`
        WITH members AS (${incidentMembers}), candidates AS (
          SELECT f.id FROM members m JOIN flags f ON f.id = m.id AND f."auditId" = m."auditId"
          WHERE f.fingerprint = ANY(${fingerprints}::text[])
          UNION
          SELECT unnest(${incident.recoveredFlagIds}::text[])
        )
        SELECT f.id, f.fingerprint, f."createdAt", i.id AS "improvementId",
          ${outcomeKind === 'CHECKOUT' ? Prisma.sql`source.coverage, legacy_checkout.capture` : Prisma.sql`NULL AS coverage, NULL AS capture`}
        FROM flags f
        JOIN candidates c ON c.id = f.id
        ${outcomeKind === 'CHECKOUT' ? Prisma.sql`
          LEFT JOIN members m ON m.id = f.id AND m."auditId" = f."auditId"
          JOIN outcome_assessments source ON source.id = COALESCE(m."assessmentId", ${before.id})
          ${historicalCheckoutCaptureJoin}
        ` : Prisma.empty}
        JOIN audits a ON a.id = f."auditId"
        LEFT JOIN improvement_occurrences o ON o."flagId" = f.id AND o."auditId" = f."auditId"
        LEFT JOIN improvements i ON i.id = o."improvementId" AND i."projectId" = a."projectId" AND i."outcomeId" = ${input.outcomeId}
        WHERE a."projectId" = ${projectId} AND f.status IN ('OPEN', 'REGRESSED')
      `
      incident.recoveredFlagIds = []
      const gaps = outcomeKind === 'CHECKOUT' ? openFlags.flatMap(flag => {
        const bindingKey = outcomeFlagOwner(flag.fingerprint)?.bindingKey ?? bindingKeys[0]
        const source = withHistoricalCheckoutDestination(flag.coverage, flag.capture)
        const reason = checkoutScopeGaps(source, input.coverage).get(bindingKey)
        return reason ? [{ ...flag, reason }] : []
      }) : []
      checkoutGaps = [...Map.groupBy(gaps, flag => flag.fingerprint ?? flag.id).values()]
        .map(group => newestRecordedFlag(group)!.id)
      checkoutGapReason = gaps.find(flag => flag.reason === 'checkout_destination_changed')?.reason ?? gaps[0]?.reason
      if (checkoutGapReason && incident.transition === 'recovery') {
        // A visit can recover one capture while leaving another capture of the
        // same binding unverified. Keep the browser observation intact.
        incident.transition = 'unknown'
        assessment.state = 'COULD_NOT_VERIFY'
        assessment.summary = OUTCOME_DETAIL_COPY.checkoutComparison[checkoutGapReason].summary
        assessment.validUntil = assessedAt
      }
      const gapIds = new Set(gaps.map(flag => flag.id))
      const passingFlags = openFlags.filter(flag => !gapIds.has(flag.id))
      if (passingFlags.length) {
        const owners = new Map(passingFlags.map(flag => [flag.id, flag.improvementId]))
        const ledgerIds = [...new Set(passingFlags.flatMap(flag => flag.improvementId ? [flag.improvementId] : []))].sort()
        for (const id of ledgerIds) await lockImprovementLedger(tx, id)
        const recovered = await tx.flag.updateManyAndReturn({ where: { id: { in: passingFlags.map(flag => flag.id) }, audit: { projectId },
          status: { in: ['OPEN', 'REGRESSED'] } }, data: { status: 'FIXED', resolvedInId: input.auditId },
          select: { id: true, fingerprint: true, createdAt: true } })
        // The receipt names the capture the inbox links to, one per binding.
        // Base it on committed changes, even if a competing writer won a Flag.
        const byIdentity = Map.groupBy(recovered, flag => flag.fingerprint ?? flag.id)
        incident.recoveredFlagIds = [...byIdentity.values()].map(group => newestRecordedFlag(group)!.id).slice(0, 100)
        if (incident.transition !== 'recovery' && recovered.length)
          incident.recoveredBindingKeys = [...new Set(recovered.flatMap(flag => outcomeFlagOwner(flag.fingerprint)?.bindingKey ?? []))].sort()
        const stillOpen = new Set(gaps.map(flag => flag.improvementId))
        const repairedIds = [...new Set(recovered.flatMap(flag => owners.get(flag.id) ?? []))].filter(id => !stillOpen.has(id))
        if (repairedIds.length) await tx.improvement.updateMany({ where: { id: { in: repairedIds }, projectId, outcomeId: input.outcomeId,
          status: { notIn: ['REJECTED', 'SUPERSEDED'] } }, data: { status: 'VERIFIED' } })
      }
    }
    const scopedCheckoutFailures = !superseding && outcomeKind === 'CHECKOUT' && input.state === 'FLAG'
      ? currentFlags.flatMap(flag => {
        const bindingKey = outcomeFlagOwner(flag.fingerprint)?.bindingKey
        const scope = bindingKey && recordedCheckoutFailureScope(input.coverage, bindingKey)
        return flag.fingerprint && bindingKey && scope ? [{ fingerprint: flag.fingerprint, bindingKey, scope }] : []
      }) : []
    const checkoutHistory = await checkoutFailureHistory(tx, { projectId, outcomeId: input.outcomeId, requestedAt: request.requestedAt,
      assessedAt, coverage: input.coverage, failures: scopedCheckoutFailures, previous: before?.state === 'FLAG' ? before : null })
    let regressedFlagIds = !superseding && incident.transition === 'regression'
      ? currentFlags.filter(flag => !checkoutHistory.has(flag.fingerprint ?? '')).map(flag => flag.id) : []
    if (!superseding && bindingResults?.size && input.state === 'FLAG' && incident.incidentRunRequestId) {
      const failures = currentFlags.filter(flag => !checkoutHistory.has(flag.fingerprint ?? '') &&
        bindingResults.get(outcomeFlagOwner(flag.fingerprint)?.bindingKey ?? '') === 'FAILED')
      if (failures.length) {
        const ongoing = incident.transition === 'ongoing_failure'
        const history = ongoing ? await tx.$queryRaw<Array<{ fingerprint: string; recovered: boolean }>>`
          WITH members AS (${incidentMembers})
          SELECT f.fingerprint, NOT bool_or(f.status IN ('OPEN', 'REGRESSED')) AND bool_or(f.status = 'FIXED' AND EXISTS (
            SELECT 1 FROM outcome_assessments source ${outcomeReceiptJoins}
            WHERE ${historyScope} AND source."auditId" = f."resolvedInId" AND NOT (${supersededOutcomeReceiptSql})
              AND source.evidence #>> '{incident,incidentRunRequestId}' = ${incident.incidentRunRequestId}
              AND source.evidence #> '{incident,recoveredFlagIds}' @> jsonb_build_array(f.id)
          )) AS recovered
          FROM members m JOIN flags f ON f.id = m.id AND f."auditId" = m."auditId"
          WHERE f.fingerprint = ANY(${failures.map(flag => flag.fingerprint)}::text[])
          GROUP BY f.fingerprint
        ` : []
        const byFingerprint = new Map(history.map(row => [row.fingerprint, row]))
        const firstFailures = failures.filter(flag => flag.fingerprint && !byFingerprint.has(flag.fingerprint))
        if (ongoing && firstFailures.length)
          incident.rootFlagIds = [...new Set([...incident.rootFlagIds, ...firstFailures.map(flag => flag.id)])].slice(0, 100)
        // A binding can return after its previous Outcome incident closed.
        // An unrelated sibling's recovery cannot establish that recurrence.
        if (firstFailures.length) {
          const recoveries = await tx.$queryRaw<Array<{ fingerprint: string; state: string; coverage: unknown; evidence: unknown }>>`
            SELECT f.fingerprint, source.state, source.coverage, source.evidence
            FROM outcome_assessments source ${outcomeReceiptJoins}
            JOIN flags f ON f."resolvedInId" = source."auditId" AND f.status = 'FIXED'
            JOIN audits original ON original.id = f."auditId" AND original."projectId" = request."projectId"
            WHERE ${historyScope} AND NOT (${supersededOutcomeReceiptSql})
              AND source."assessedAt" <= ${assessedAt} AND request."requestedAt" < ${request.requestedAt}
              AND f.fingerprint = ANY(${firstFailures.map(flag => flag.fingerprint)}::text[])
              AND source.evidence #> '{incident,recoveredFlagIds}' @> jsonb_build_array(f.id)
          `
          for (const row of recoveries) {
            if (byFingerprint.has(row.fingerprint) || !comparableOutcomeCoverage(row.coverage, input.coverage)) continue
            const recovery = readOutcomeRecovery(row.evidence, row.state)
            const key = outcomeFlagOwner(row.fingerprint)?.bindingKey
            if (recovery && key && (!recovery.recoveredBindingKeys || recovery.recoveredBindingKeys.includes(key)))
              byFingerprint.set(row.fingerprint, { fingerprint: row.fingerprint, recovered: true })
          }
        }
        regressedFlagIds = failures.filter(flag => flag.fingerprint && byFingerprint.get(flag.fingerprint)?.recovered).map(flag => flag.id)
        if (!ongoing) incident.transition = regressedFlagIds.length ? 'regression' : 'failure'
        if (regressedFlagIds.length) incident.regressedFlagIds = regressedFlagIds
      }
    }
    if (checkoutHistory.size) {
      const added = currentFlags.filter(flag => checkoutHistory.get(flag.fingerprint ?? '') === 'new')
      const regressed = currentFlags.filter(flag => checkoutHistory.get(flag.fingerprint ?? '') === 'regressed')
      regressedFlagIds = [...regressedFlagIds, ...regressed.map(flag => flag.id)]
      if (incident.transition === 'ongoing_failure')
        incident.rootFlagIds = [...new Set([...incident.rootFlagIds, ...added.map(flag => flag.id)])].slice(0, 100)
      else incident.transition = regressedFlagIds.length ? 'regression' : 'failure'
      if (regressedFlagIds.length) incident.regressedFlagIds = regressedFlagIds
    }
    if (regressedFlagIds.length) {
      await tx.flag.updateMany({ where: { id: { in: regressedFlagIds }, status: 'OPEN' }, data: { status: 'REGRESSED' } })
      await tx.improvementOccurrence.updateMany({ where: { flagId: { in: regressedFlagIds } }, data: { kind: 'REGRESSED' } })
    }
    const unverifiedKeys = bindingKeys.filter(key => !bindingResults?.has(key))
    if (!superseding && (incident.transition === 'unknown' || bindingResults && unverifiedKeys.length)) {
      // Freeze which open findings this run could not recheck. Later repairs
      // must not change the comparison, and old roots can have since recurred.
      incident.inconclusiveFlagIds = []
      if (before?.state === 'FLAG' && incident.incidentRunRequestId && unverifiedKeys.length) {
        const fingerprints = unverifiedKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key))
        const legacyFingerprint = `outcome:${outcomeKind.toLowerCase()}:${unverifiedKeys[0]}`
        const unresolved = await tx.$queryRaw<Array<{ id: string }>>`
          WITH members AS (${incidentMembers}), candidates AS (
            SELECT f.id, f.fingerprint AS identity, false AS legacy
            FROM members m JOIN flags f ON f.id = m.id AND f."auditId" = m."auditId"
            WHERE f.fingerprint = ANY(${fingerprints}::text[])
            UNION
            SELECT f.id, ${fingerprints[0]}::text AS identity, true AS legacy FROM flags f
            WHERE ${bindingKeys.length === 1} AND f.id = ANY(${incident.rootFlagIds}::text[])
              AND f.fingerprint = ${legacyFingerprint}
          )
          SELECT DISTINCT ON (c.identity) f.id FROM candidates c JOIN flags f ON f.id = c.id
          JOIN audits a ON a.id = f."auditId"
          WHERE a."projectId" = ${projectId} AND f.status IN ('OPEN', 'REGRESSED')
          ORDER BY c.identity, c.legacy, f."createdAt" DESC, f.id DESC LIMIT 100
        `
        incident.inconclusiveFlagIds = unresolved.map(flag => flag.id)
      }
    }
    const evidence = input.evidence && typeof input.evidence === 'object' && !Array.isArray(input.evidence) ? input.evidence : {}
    if (checkoutGaps.length)
      incident.inconclusiveFlagIds = [...new Set([...checkoutGaps, ...incident.inconclusiveFlagIds ?? []])].slice(0, 100)
    return tx.outcomeAssessment.create({ data: { ...assessment,
      improvementId: boundImprovements.keys().next().value ?? legacy?.improvementId ?? input.improvementId ??
        (readOutcomeIncident(before?.evidence) ? before?.improvementId : undefined),
      evidence: { ...evidence, ...(checkoutGapReason && assessment.state === 'COULD_NOT_VERIFY' ? { reason: checkoutGapReason } : {}),
        ...(superseding ? { supersededByAssessmentId: superseding.id } : {}), incident } as Prisma.InputJsonValue } })
  })
}
