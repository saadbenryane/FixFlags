import { prisma } from '@/lib/db'
import { calculateSiteValueCohort, type SiteValueFollowupDays } from './site-value-cohort'

export async function loadSiteValueCohort(input: { since: Date; now?: Date; followupDays?: SiteValueFollowupDays }, db: Pick<typeof prisma,'$transaction'> = prisma) {
  const now = input.now ?? new Date()
  const followupDays = input.followupDays ?? 7
  if (followupDays !== 7 && followupDays !== 28) throw new Error('Invalid Site follow-up duration')
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(input.since.getTime()) || input.since > now) throw new Error('Invalid Site value window')
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    // Read before applying the cohort window. Otherwise a later claim could masquerade as the first.
    const claims = await tx.siteLifecycleEvent.findMany({ where: { name:'analysis_claimed',version:1,
      projectId:{not:null},userId:{not:null},idempotencyKey:{startsWith:'analysis_claimed:'},createdAt:{lte:now} },
      orderBy:[{createdAt:'asc'},{id:'asc'}],take:50_001,
      select:{idempotencyKey:true,projectId:true,userId:true,createdAt:true} })
    if (claims.length > 50_000) throw new Error('Site claim history exceeds reporting limit')
    const first = new Map<string,typeof claims[number]>()
    for (const claim of claims) if (claim.projectId && !first.has(claim.projectId)) first.set(claim.projectId,claim)
    const cohort = [...first.values()].filter(claim => claim.createdAt >= input.since)
    const ids = cohort.map(claim => claim.projectId!)
    const auditSelect = {id:true,userId:true,projectId:true,parentId:true,source:true,status:true,createdAt:true,startedAt:true,completedAt:true,
      project:{select:{id:true,userId:true,deletedAt:true}}} as const
    const [sites,runs,cycles] = await Promise.all([
      ids.length ? tx.project.findMany({where:{id:{in:ids}},select:{id:true,userId:true,createdAt:true,deletedAt:true}}) : [],
      ids.length ? tx.runRequest.findMany({where:{projectId:{in:ids},environment:'production',requestedAt:{gte:input.since,lte:now}},take:50_001,
        select:{projectId:true,requestedByUserId:true,source:true,status:true,environment:true,requestedAt:true,completedAt:true,auditId:true}}) : [],
      ids.length ? tx.improvementCycle.findMany({where:{projectId:{in:ids},createdAt:{lte:now}},take:50_001,
        select:{id:true,projectId:true,sourceAuditId:true,improvementId:true,createdAt:true,improvement:{select:{projectId:true}},
          occurrence:{select:{improvementId:true,auditId:true,flag:{select:{auditId:true,createdAt:true}}}},
          events:{where:{occurredAt:{lte:now}},select:{type:true,transport:true,occurredAt:true,outcome:true,attemptId:true,verificationAuditId:true,
            attempt:{select:{id:true,sourceAuditId:true,improvementId:true,createdAt:true}}}}}}) : [],
    ])
    if (runs.length > 50_000 || cycles.length > 50_000) throw new Error('Site value evidence exceeds reporting limit')
    const auditIds = [...new Set([
      ...cohort.map(claim=>claim.idempotencyKey.slice('analysis_claimed:'.length)),
      ...runs.flatMap(run=>run.auditId?[run.auditId]:[]),
      ...cycles.flatMap(cycle=>[cycle.sourceAuditId,...cycle.events.flatMap(event=>event.verificationAuditId?[event.verificationAuditId]:[])]),
    ])]
    const audits = auditIds.length ? await tx.audit.findMany({where:{id:{in:auditIds}},select:auditSelect}) : []
    return calculateSiteValueCohort({claims,sites,runs,cycles,audits,since:input.since,now,followupDays})
  },{isolationLevel:'RepeatableRead'})
}
