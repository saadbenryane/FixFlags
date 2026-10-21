import { describe, expect, it } from 'vitest'
import { calculateSiteValueCohort, type ValueRun } from '../site-value-cohort'
import type { AcquisitionAudit, AcquisitionCycle } from '../acquisition-value-cohort'
const at=(day:number)=>new Date(Date.UTC(2026,9,1)+day*86_400_000)
const audit=(id:string,day:number):AcquisitionAudit=>({id,projectId:'private-site',userId:'private-owner',parentId:null,source:'DASHBOARD',status:'COMPLETED',
  createdAt:at(day),startedAt:at(day+.1),completedAt:at(day+.2),project:{id:'private-site',userId:'private-owner',deletedAt:null}})
const run=(id:string,day:number,source='WATCH'):ValueRun=>({projectId:'private-site',requestedByUserId:'private-owner',source,status:'COMPLETED',environment:'production',requestedAt:at(day),completedAt:at(day+.3),auditId:id})
function fixture(){
  const attempt={id:'private-attempt',sourceAuditId:'later',improvementId:'private-improvement',createdAt:at(2.5)}
  const cycle:AcquisitionCycle={id:'private-cycle',projectId:'private-site',sourceAuditId:'later',improvementId:attempt.improvementId,createdAt:at(2.3),
    improvement:{projectId:'private-site'},occurrence:{improvementId:attempt.improvementId,auditId:'later',flag:{auditId:'later',createdAt:at(2.2)}},
    events:[{type:'GENERATED',transport:'SYSTEM',occurredAt:at(2.3),outcome:null,attemptId:null,verificationAuditId:null,attempt:null},
      {type:'ATTEMPTED',transport:'WEB',occurredAt:at(2.5),outcome:null,attemptId:attempt.id,verificationAuditId:null,attempt},
      {type:'OUTCOME_ISSUED',transport:'SYSTEM',occurredAt:at(3.3),outcome:'IMPROVED',attemptId:attempt.id,verificationAuditId:'after',attempt}]}
  return {since:at(0),now:at(10),claims:[{idempotencyKey:'analysis_claimed:initial',projectId:'private-site',userId:'private-owner',createdAt:at(1)}],
    sites:[{id:'private-site',userId:'private-owner',createdAt:at(1),deletedAt:null as Date|null}],
    audits:[audit('initial',0),audit('later',2),audit('after',3),audit('post-monitor',4),audit('return',5)],
    cycles:[cycle],runs:[run('later',2),run('post-monitor',4),run('return',5,'WEB')]}
}
describe('continuing Site value',()=>{
  it('counts a later-source repair and a completed subsequent monitor once per Site',()=>{
    const input=fixture();input.cycles.push(input.cycles[0]);input.runs.push(input.runs[0])
    const report=calculateSiteValueCohort(input)
    expect(report).toMatchObject({status:'available',counts:{sites:1,completedScheduledChecks:1,initialOrLaterIssueCycles:1,
      recordedFixAttempts:1,independentlyImproved:1,completedMonitoringAfterImprovement:1,ownerRequestedFollowup:1}})
    expect(JSON.stringify(report)).not.toContain('private-')
  })
  it('preserves the seven-day default and counts later activity only in a mature 28-day cohort',()=>{
    const input=fixture();input.now=at(40);input.cycles=[]
    input.audits.push(audit('late',20));input.runs=[run('late',20)]
    expect(calculateSiteValueCohort(input)).toMatchObject({followupDays:7,counts:{sites:1,completedScheduledChecks:0}})
    expect(calculateSiteValueCohort({...input,followupDays:7})).toEqual(calculateSiteValueCohort(input))
    expect(calculateSiteValueCohort({...input,followupDays:28})).toMatchObject({followupDays:28,counts:{sites:1,completedScheduledChecks:1}})
  })
  it('excludes immature 28-day Sites before counts and shares, including the maturity boundary',()=>{
    const input=fixture();input.now=at(28.99)
    const immature=calculateSiteValueCohort({...input,followupDays:28})
    expect(immature).toMatchObject({counts:{sites:0,completedScheduledChecks:0,independentlyImproved:0},coverage:{firstRecordedClaims:1,immatureSites:1}})
    expect(immature.observedSharesPct.completedScheduledChecks).toBeNull()
    input.now=at(29)
    expect(calculateSiteValueCohort({...input,followupDays:28})).toMatchObject({counts:{sites:1,independentlyImproved:1},coverage:{immatureSites:0}})
  })
  it('keeps 28-day event boundaries and owner evidence checks',()=>{
    const input=fixture();input.now=at(40);input.cycles=[]
    input.audits.push(audit('late',29));input.runs=[run('late',29)]
    expect(calculateSiteValueCohort({...input,followupDays:28})).toMatchObject({status:'partial',counts:{completedScheduledChecks:0},coverage:{rejectedRuns:1}})
    input.runs=[run('later',2)];input.sites[0].userId='other'
    expect(calculateSiteValueCohort({...input,followupDays:28})).toMatchObject({status:'partial',counts:{completedScheduledChecks:0},coverage:{unavailableOwnerLinks:1}})
  })
  it('refuses unsupported follow-up durations instead of silently changing denominators',()=>{
    expect(()=>calculateSiteValueCohort({...fixture(),followupDays:14 as 7})).toThrow('Invalid Site follow-up duration')
  })
  it('does not treat another scheduled check as proof of continuing recovery or a human return',()=>{
    const input=fixture();input.runs=input.runs.filter(run=>run.source==='WATCH')
    expect(calculateSiteValueCohort(input).counts).toMatchObject({completedMonitoringAfterImprovement:1,ownerRequestedFollowup:0})
    input.runs[1].requestedAt=at(3)
    expect(calculateSiteValueCohort(input).counts.completedMonitoringAfterImprovement).toBe(0)
  })
  it('chooses first claims before window filtering and excludes immature Sites',()=>{
    const input=fixture();input.claims.push({...input.claims[0],createdAt:at(8)})
    input.since=at(2)
    expect(calculateSiteValueCohort(input).counts.sites).toBe(0)
    input.claims=[{...input.claims[0],createdAt:at(8)}];input.since=at(0)
    expect(calculateSiteValueCohort(input)).toMatchObject({counts:{sites:0},coverage:{immatureSites:1}})
  })
  it.each(['deleted','owner','claim-source','run-site','unfinished-audit','attempt-source','self-report'])('withholds unproven Site value (%s)',scenario=>{
    const input=fixture()
    if(scenario==='deleted')input.sites[0].deletedAt=at(5)
    if(scenario==='owner')input.sites[0].userId='other'
    if(scenario==='claim-source')input.claims[0].idempotencyKey='analysis_claimed:missing'
    if(scenario==='run-site')input.audits[1].projectId='other'
    if(scenario==='unfinished-audit')input.audits[1].status='RUNNING'
    if(scenario==='attempt-source')input.cycles[0].events[2].attempt!.sourceAuditId='other'
    if(scenario==='self-report')input.cycles[0].events[2].transport='WEB'
    const report=calculateSiteValueCohort(input)
    expect(report.status).toBe('partial')
    expect(report.observedSharesPct.independentlyImproved).toBeNull()
    if(scenario==='unfinished-audit')expect(report.counts.independentlyImproved).toBe(0)
  })
  it('allows audit creation before its request bookkeeping, but requires actual execution after admission',()=>{
    const input=fixture();input.audits[1].createdAt=at(1.99)
    expect(calculateSiteValueCohort(input).counts.completedScheduledChecks).toBe(1)
    input.audits[1].startedAt=at(1.9)
    expect(calculateSiteValueCohort(input).status).toBe('partial')
  })
  it('excludes late events and preserves unavailable empty-denominator shares',()=>{
    const input=fixture();input.runs[1].requestedAt=at(9);input.cycles[0].events[2].occurredAt=at(9)
    expect(calculateSiteValueCohort(input).counts.independentlyImproved).toBe(0)
    input.claims=[]
    expect(calculateSiteValueCohort(input).observedSharesPct.independentlyImproved).toBeNull()
  })

  it('does not treat a validation run or another actor’s request as customer follow-up',()=>{
    const input=fixture();input.runs.forEach(run=>{run.environment='public-validation'})
    expect(calculateSiteValueCohort(input).counts).toMatchObject({completedScheduledChecks:0,ownerRequestedFollowup:0})
    input.runs[2].environment='production';input.runs[2].requestedByUserId='other'
    expect(calculateSiteValueCohort(input).counts.ownerRequestedFollowup).toBe(0)
  })
})
