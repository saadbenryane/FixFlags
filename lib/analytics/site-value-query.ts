import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ACQUISITION_FOLLOWUP_DAYS, fixedStartWindow } from './acquisition-value-cohort'
import { calculateSiteValueCohort, type OwnerClipboardHandoff, type SiteValueFollowupDays } from './site-value-cohort'
import { readOutcomeRecoveryEvidence } from './outcome-recovery-query'
import { COPIED_HANDOFF_CLIENT, handoffProtocolSuffix } from '@/lib/improvements/handoff-contract'
import { readPublicLinkFollowup } from './public-link-followup-query'

type SiteValueWindow = { since: Date; now?: Date; startWindowEnd?: Date; followupDays?: SiteValueFollowupDays;
  includeNativeOutcomeRecovery?: boolean }

function validateSiteValueCohort(input: SiteValueWindow & { now: Date }) {
  const now = input.now
  const followupDays = input.followupDays ?? 7
  if (followupDays !== 7 && followupDays !== 28) throw new Error('Invalid Site follow-up duration')
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(input.since.getTime()) || input.since > now) throw new Error('Invalid Site value window')
  const claimLag = ACQUISITION_FOLLOWUP_DAYS * 86_400_000
  const window = input.startWindowEnd &&
    fixedStartWindow(input.since, input.startWindowEnd, now, ACQUISITION_FOLLOWUP_DAYS + followupDays)
  const lastClaim = input.startWindowEnd ? new Date(Math.min(now.getTime(), input.startWindowEnd.getTime() + claimLag)) : now
  const evidenceCutoff = window?.fullyMature ? new Date(window.fullyMatureAt) : now
  return { now, followupDays, claimLag, lastClaim, evidenceCutoff }
}

/** Match the prepared task and owner receipt in SQL. Keep the prompt hash,
 * reference identities and repair context out of the reporting projection. */
async function readOwnerClipboardHandoffs(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, ids: string[], since: Date, cutoff: Date) {
  if (!ids.length) return []
  const suffix = handoffProtocolSuffix(COPIED_HANDOFF_CLIENT)
  const rows = await tx.$queryRaw<OwnerClipboardHandoff[]>`
    SELECT DISTINCT cycle."projectId", event."occurredAt", acknowledgement."createdAt" AS "acknowledgedAt",
      followup.id AS "resultEventId"
    FROM improvement_cycle_events event
    JOIN improvement_cycles cycle ON cycle.id = event."cycleId"
    JOIN improvements improvement ON improvement.id = cycle."improvementId" AND improvement."projectId" = cycle."projectId"
    JOIN improvement_occurrences occurrence ON occurrence.id = cycle."occurrenceId"
      AND occurrence."improvementId" = improvement.id AND occurrence."auditId" = cycle."sourceAuditId"
    JOIN flags flag ON flag.id = occurrence."flagId" AND flag."auditId" = cycle."sourceAuditId"
    JOIN audits audit ON audit.id = cycle."sourceAuditId" AND audit."projectId" = cycle."projectId"
    JOIN projects site ON site.id = cycle."projectId" AND site."userId" = audit."userId" AND site."deletedAt" IS NULL
    JOIN site_lifecycle_events acknowledgement
      ON acknowledgement."idempotencyKey" = ('fix-handoff:' || site."userId" || ':' || flag.id || ':copy' || ${suffix})
      AND acknowledgement.name = 'fix_handoff' AND acknowledgement.version = 1 AND acknowledgement."userId" = site."userId"
      AND (acknowledgement."projectId" IS NULL OR acknowledgement."projectId" = site.id)
      AND acknowledgement.properties->>'channel' = 'copy' AND acknowledgement.properties->>'client' = ${COPIED_HANDOFF_CLIENT}
      AND acknowledgement."createdAt" BETWEEN event."occurredAt" AND ${cutoff}
    LEFT JOIN LATERAL (
      SELECT result.id
      FROM improvement_cycle_events result
      JOIN improvement_attempts attempt ON attempt.id = result."attemptId"
        AND attempt."sourceAuditId" = cycle."sourceAuditId" AND attempt."improvementId" = cycle."improvementId"
        AND attempt."verificationAuditId" = result."verificationAuditId"
        AND attempt."handoffReference" = ('flag:' || flag.id) AND attempt.frozen
        AND attempt."createdAt" > acknowledgement."createdAt"
      CROSS JOIN LATERAL (VALUES (
        event."contextCorrection" #> '{context,sourceFlagIds}',
        CASE WHEN cardinality(attempt."sourceFlagIds") > 0 THEN attempt."sourceFlagIds" ELSE ARRAY[flag.id] END
      )) scope(copied, frozen)
      WHERE result."cycleId" = cycle.id AND result.type = 'OUTCOME_ISSUED' AND result.transport = 'SYSTEM'
        AND result."occurredAt" BETWEEN attempt."createdAt" AND ${cutoff}
        AND CASE WHEN jsonb_typeof(scope.copied) = 'array' THEN
          jsonb_array_length(scope.copied) = cardinality(scope.frozen)
          AND scope.copied @> jsonb_build_array(flag.id)
          AND scope.copied @> to_jsonb(scope.frozen)
          AND scope.copied <@ to_jsonb(scope.frozen)
        ELSE false END
    ) followup ON true
    WHERE cycle."projectId" = ANY(${ids}::text[]) AND event."occurredAt" BETWEEN ${since} AND ${cutoff}
      AND event.type = 'HANDOFF_COPIED' AND event.transport = 'copy' AND event.client = ${COPIED_HANDOFF_CLIENT}
      AND audit.status = 'COMPLETED' AND audit."completedAt" BETWEEN audit."createdAt" AND event."occurredAt"
      AND audit."createdAt" <= flag."createdAt" AND flag."createdAt" <= event."occurredAt"
      AND cycle."createdAt" BETWEEN audit."createdAt" AND event."occurredAt"
      AND event."contextCorrection"->>'schemaVersion' = 'fixflags.handoff-receipt.v1'
      AND event."contextCorrection"->>'sourceFlagId' = flag.id
      AND NULLIF(event."contextCorrection"->>'referenceFlagId', '') IS NOT NULL
      AND event."contextCorrection"->>'promptHash' ~ '^[a-f0-9]{64}$'
      AND event."contextCorrection" #>> '{context,contextHash}' ~ '^[a-f0-9]{64}$'
      AND event."contextCorrection" #>> '{context,sourceAuditId}' = audit.id
      AND event."contextCorrection" #>> '{context,kind}' = 'repair'
    LIMIT 50001
  `
  if (rows.length > 50_000) throw new Error('Site handoff evidence exceeds reporting limit')
  return rows
}

export async function loadSiteValueCohort(input: SiteValueWindow, db: Pick<typeof prisma, '$transaction'> = prisma) {
  const window = { ...input, now: input.now ?? new Date() }
  validateSiteValueCohort(window)
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    return readSiteValueCohort(tx, window)
  }, { isolationLevel: 'RepeatableRead' })
}

export async function readSiteValueCohort(tx: Prisma.TransactionClient, input: SiteValueWindow & { now: Date }) {
  const { now, followupDays, claimLag, lastClaim, evidenceCutoff } = validateSiteValueCohort(input)
  // Read before applying the cohort window. Otherwise a later claim could masquerade as the first.
  const claims = await tx.siteLifecycleEvent.findMany({ where: { name:'analysis_claimed',version:1,
    projectId:{not:null},userId:{not:null},idempotencyKey:{startsWith:'analysis_claimed:'},createdAt:{lte:lastClaim} },
    orderBy:[{createdAt:'asc'},{id:'asc'}],take:50_001,
    select:{idempotencyKey:true,projectId:true,userId:true,createdAt:true} })
  if (claims.length > 50_000) throw new Error('Site claim history exceeds reporting limit')
  const first = new Map<string,typeof claims[number]>()
  for (const claim of claims) if (claim.projectId && !first.has(claim.projectId)) first.set(claim.projectId,claim)
  const cohort = [...first.values()].filter(claim => claim.createdAt >= input.since)
  const ids = cohort.map(claim => claim.projectId!)
  const initialAuditIds = cohort.map(claim => claim.idempotencyKey.slice('analysis_claimed:'.length))
  const startDates = input.startWindowEnd ? { gte: input.since, lt: input.startWindowEnd }
    : { gte: new Date(input.since.getTime() - claimLag), lte: now }
  const auditSelect = {id:true,userId:true,projectId:true,parentId:true,source:true,status:true,createdAt:true,startedAt:true,completedAt:true,
    project:{select:{id:true,userId:true,deletedAt:true}}} as const
  const [sites,runs,cycles,starts] = await Promise.all([
    ids.length ? tx.project.findMany({where:{id:{in:ids}},select:{id:true,userId:true,createdAt:true,deletedAt:true}}) : [],
    ids.length ? tx.runRequest.findMany({where:{projectId:{in:ids},environment:'production',requestedAt:{gte:input.since,lte:evidenceCutoff}},take:50_001,
      select:{projectId:true,requestedByUserId:true,source:true,status:true,environment:true,requestedAt:true,completedAt:true,auditId:true}}) : [],
    ids.length ? tx.improvementCycle.findMany({where:{projectId:{in:ids},createdAt:{lte:evidenceCutoff}},take:50_001,
      select:{id:true,projectId:true,sourceAuditId:true,improvementId:true,createdAt:true,improvement:{select:{projectId:true}},
        occurrence:{select:{improvementId:true,auditId:true,flag:{select:{id:true,auditId:true,createdAt:true,checkId:true,verificationRule:true}}}},
        events:{where:{occurredAt:{lte:evidenceCutoff}},select:{id:true,type:true,transport:true,occurredAt:true,outcome:true,attemptId:true,verificationAuditId:true,
          attempt:{select:{id:true,sourceAuditId:true,improvementId:true,createdAt:true}}}}}}) : [],
    initialAuditIds.length ? tx.siteLifecycleEvent.findMany({ where: {
      name: 'analyze_started', version: 1, userId: null, createdAt: startDates,
      idempotencyKey: { in: initialAuditIds.map(id => `analyze_started:${id}`) },
    }, select: { idempotencyKey: true, properties: true, createdAt: true, userId: true, version: true } }) : [],
  ])
  if (runs.length > 50_000 || cycles.length > 50_000) throw new Error('Site value evidence exceeds reporting limit')
  const auditIds = [...new Set([
    ...initialAuditIds,
    ...runs.flatMap(run=>run.auditId?[run.auditId]:[]),
    ...cycles.flatMap(cycle=>[cycle.sourceAuditId,...cycle.events.flatMap(event=>event.verificationAuditId?[event.verificationAuditId]:[])]),
  ])]
  const matureWindows = new Map(cohort.flatMap(claim => {
    const end = new Date(claim.createdAt.getTime() + followupDays * 86_400_000)
    return end <= now ? [[claim.projectId!, { start: claim.createdAt, end }] as const] : []
  }))
  const matureIds = [...matureWindows.keys()]
  const [audits, outcomeEvidence, clipboardHandoffs, publicLinkFollowup] = await Promise.all([
    auditIds.length ? tx.audit.findMany({where:{id:{in:auditIds}},select:auditSelect}) : [],
    input.includeNativeOutcomeRecovery ? readOutcomeRecoveryEvidence(tx, { since: input.since, now: evidenceCutoff,
      projectIds: matureIds }) : undefined,
    readOwnerClipboardHandoffs(tx, matureIds, input.since, evidenceCutoff),
    readPublicLinkFollowup(tx, cycles, runs, matureWindows),
  ])
  return calculateSiteValueCohort({...input,claims,sites,runs,cycles,audits,starts,now,followupDays,outcomeEvidence,clipboardHandoffs,publicLinkFollowup})
}
