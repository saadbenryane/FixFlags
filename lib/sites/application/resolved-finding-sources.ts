import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { incidentAffectedPaths, newestRecordedFlag } from '../flag-resolution'
import { canonicalIntent } from '../domain/execution-spec'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs } from './incident-proofs'
import { SiteRunRefusal } from './run-refusal'
import { loadAcceptedFlagRecoveries } from './accepted-flag-recoveries'

const BATCH = 128
const HISTORY_LIMIT = 50
const sourceSelect = { ...incidentRecoveryFlagSelect, createdAt: true, improvementOccurrence: { select: { improvementId: true } } } satisfies Prisma.FlagSelect
type Source = Prisma.FlagGetPayload<{ select: typeof sourceSelect }>
type Candidate = {
  kind: 'fixed' | 'attempt'; kindOrder: number; identity: string; candidateId: string; recoveredAt: Date | null; proofId: string;
  improvementId: string | null; flagId: string | null; sourceAuditId: string | null; handoffReference: string | null;
  capturedSelection: boolean;
}
export type ResolvedFindingSource = {
  source: Source; improvementId: string | null; recoveredAt: Date | null; affectedPaths: string[];
  status: 'FIXED' | 'VERIFIED'; resolvedInId: string | null;
}

/** These are candidate references, never certificates. Native recovery still
 * compares every original condition; legacy outcomes retain their exact lineage. */
async function candidates(projectId: string, after?: Candidate) {
  const laterKey = after ? Prisma.sql`("identity", "kindOrder", "candidateId") > (${after.identity}, ${after.kindOrder}, ${after.candidateId})` : Prisma.empty
  const continuation = !after ? Prisma.empty : after.recoveredAt
    ? Prisma.sql`WHERE "recoveredAt" < ${after.recoveredAt} OR "recoveredAt" IS NULL
        OR ("recoveredAt" = ${after.recoveredAt} AND ${laterKey})`
    : Prisma.sql`WHERE "recoveredAt" IS NULL AND ${laterKey}`
  return prisma.$queryRaw<Candidate[]>`
    WITH candidates AS (
      SELECT DISTINCT 'fixed'::text AS "kind", 0 AS "kindOrder", COALESCE(i.id, f.id) AS "identity", recovery.id AS "candidateId",
        recovery."completedAt" AS "recoveredAt", recovery.id AS "proofId", i.id AS "improvementId",
        CASE WHEN i.id IS NULL THEN f.id ELSE NULL END AS "flagId", NULL::text AS "sourceAuditId", NULL::text AS "handoffReference",
        false AS "capturedSelection"
      FROM flags f JOIN audits source ON source.id=f."auditId"
      JOIN audits recovery ON recovery.id=f."resolvedInId" AND recovery."projectId"=source."projectId"
      LEFT JOIN improvement_occurrences occurrence ON occurrence."flagId"=f.id
      LEFT JOIN improvements i ON i.id=occurrence."improvementId" AND i."projectId"=source."projectId"
      WHERE source."projectId"=${projectId} AND f.status='FIXED' AND recovery.status='COMPLETED' AND recovery."completedAt" IS NOT NULL
        AND (occurrence.id IS NULL OR (occurrence."auditId"=f."auditId" AND i.id IS NOT NULL))
      UNION ALL
      SELECT 'attempt'::text, 1, i.id, attempt.id, verification."completedAt", verification.id, i.id, NULL::text,
        attempt."sourceAuditId", attempt."handoffReference",
        (attempt."sourceObservations" IS NOT NULL AND cardinality(attempt."sourceFlagIds") > 0)
      FROM improvement_attempts attempt JOIN improvements i ON i.id=attempt."improvementId"
      JOIN audits attempt_source ON attempt_source.id=attempt."sourceAuditId" AND attempt_source."projectId"=i."projectId"
      JOIN audits verification ON verification.id=attempt."verificationAuditId" AND verification."projectId"=i."projectId"
        AND verification."parentId"=attempt."sourceAuditId" AND verification.status='COMPLETED'
      WHERE i."projectId"=${projectId} AND attempt.outcome='IMPROVED' AND attempt.comparable=true
        AND EXISTS (SELECT 1 FROM improvement_occurrences occurrence JOIN flags f ON f.id=occurrence."flagId"
          JOIN audits source ON source.id=f."auditId" AND source."projectId"=i."projectId"
          WHERE occurrence."improvementId"=i.id AND occurrence."auditId"=f."auditId" AND f.status='OPEN'
            AND (attempt."sourceObservations" IS NOT NULL AND cardinality(attempt."sourceFlagIds") > 0 AND f.id=ANY(attempt."sourceFlagIds")
              OR (attempt."sourceObservations" IS NULL OR cardinality(attempt."sourceFlagIds")=0)
                AND f."auditId"=attempt."sourceAuditId" AND (attempt."handoffReference" IS NULL OR attempt."handoffReference" NOT LIKE 'flag:%'
                  OR attempt."handoffReference"='flag:' || f.id)))
    ) SELECT * FROM candidates ${continuation}
    ORDER BY "recoveredAt" DESC NULLS LAST, "identity", "kindOrder", "candidateId" LIMIT ${BATCH}`
}

async function evaluateCandidates(projectId: string, selected: Candidate[]) {
  const byIdentity = new Map(selected.map(candidate => [candidate.identity, candidate]))
  const results = new Map<Candidate, { representative?: Source; paths: Set<string> }>(selected.map(candidate => [candidate, { paths: new Set<string>() }]))
  let cursor: string | undefined
  for (;;) {
    const flags = await prisma.flag.findMany({ where: { audit: { projectId }, OR: selected.map(candidate => ({
      improvementOccurrence: candidate.improvementId ? { improvementId: candidate.improvementId, audit: { projectId }, improvement: { projectId } } : null,
      ...(candidate.kind === 'fixed' ? { status: 'FIXED' as const, resolvedInId: candidate.proofId, ...(candidate.flagId ? { id: candidate.flagId } : {}) }
        : { status: 'OPEN' as const, ...(!candidate.capturedSelection ? { auditId: candidate.sourceAuditId!,
          ...(candidate.handoffReference?.startsWith('flag:') ? { id: candidate.handoffReference.slice(5) } : {}) } : {}) }),
    })) }, select: sourceSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: BATCH,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const proofs = (await loadIncidentRecoveryProofs([{ projectId, flags }])).get(projectId)
    const legacy = await loadAcceptedFlagRecoveries(projectId, flags.flatMap(flag => {
      const candidate = byIdentity.get(flag.improvementOccurrence?.improvementId ?? flag.id)
      return candidate?.kind === 'attempt' && candidate.improvementId
        ? [{ id: flag.id, auditId: flag.auditId, improvementId: candidate.improvementId, proofId: candidate.proofId }] : []
    }))
    for (const flag of flags) {
      const candidate = byIdentity.get(flag.improvementOccurrence?.improvementId ?? flag.id)
      if (!candidate) throw new SiteRunRefusal('Finding evidence changed. Try again.', 409)
      const proven = candidate.kind === 'fixed' ? flag.status === 'FIXED' && flag.resolvedInId === candidate.proofId && proofs?.hasFlag(flag)
        : legacy.get(flag.id)?.auditId === candidate.proofId
      if (!proven) continue
      const result = results.get(candidate)!
      result.representative = newestRecordedFlag([...(result.representative ? [result.representative] : []), flag])
      for (const path of incidentAffectedPaths([flag])) result.paths.add(path)
    }
    if (flags.length < BATCH) return results
    cursor = flags.at(-1)!.id
  }
}

/** Select recent proven incidents before loading any full diagnosis or editor
 * task. Repeated sources cannot consume the customer history limit. */
export async function loadResolvedFindingSources(projectId: string): Promise<ResolvedFindingSource[]> {
  const selected: ResolvedFindingSource[] = [], seen = new Set<string>()
  let after: Candidate | undefined
  for (;;) {
    const batch = await candidates(projectId, after)
    let pending = batch.filter(candidate => !seen.has(candidate.identity))
    const winners = new Map<string, { candidate: Candidate; source: Source; paths: string[] }>()
    // Share evidence among independent incidents. An older recovery for the same
    // incident is needed only when its newer candidate did not establish proof.
    while (pending.length) {
      const identities = new Set<string>()
      const round = pending.filter(candidate => {
        if (winners.has(candidate.identity) || identities.has(candidate.identity)) return false
        identities.add(candidate.identity); return true
      })
      if (!round.length) break
      for (const [candidate, result] of await evaluateCandidates(projectId, round)) if (result.representative)
        winners.set(candidate.identity, { candidate, source: result.representative, paths: [...result.paths] })
      const tested = new Set(round)
      pending = pending.filter(candidate => !tested.has(candidate))
    }
    for (const candidate of batch) {
      const winner = winners.get(candidate.identity)
      if (!winner || winner.candidate !== candidate) continue
      seen.add(candidate.identity)
      selected.push({ source: winner.source, improvementId: candidate.improvementId, recoveredAt: candidate.recoveredAt,
        affectedPaths: winner.paths, status: candidate.kind === 'fixed' ? 'FIXED' : 'VERIFIED',
        resolvedInId: candidate.proofId })
      if (selected.length >= HISTORY_LIMIT) return selected
    }
    if (batch.length < BATCH) return selected
    after = batch.at(-1)!
  }
}

/** A later source mutation cannot inherit the proof selected for earlier facts. */
export function resolvedSourceMatches(source: Source, loaded: Record<string, unknown>) {
  const inputs = (flag: Record<string, unknown>) => Object.fromEntries(Object.keys(incidentRecoveryFlagSelect).map(key => [key, flag[key]]))
  return canonicalIntent(inputs(source)) === canonicalIntent(inputs(loaded))
}
