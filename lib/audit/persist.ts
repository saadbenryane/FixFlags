import { prisma } from '@/lib/db'
import {
  AreaName,
  AreaGrade,
  AreaStatus,
  Severity,
  FindingSource,
} from '@prisma/client'
import { DeterministicFinding } from './checks'
import { JudgeOutput } from './judge'
import { verificationRuleForCheckId } from './verify-findings'

function aiGradeToEnum(grade: string): AreaGrade {
  const map: Record<string, AreaGrade> = { A: 'A', B: 'B', C: 'C', D: 'D', F: 'F' }
  return map[grade] ?? 'C'
}

function aiStatusToEnum(status: string): AreaStatus {
  const map: Record<string, AreaStatus> = {
    EXCELLENT: 'EXCELLENT',
    GOOD: 'GOOD',
    NEEDS_WORK: 'NEEDS_WORK',
    CRITICAL: 'CRITICAL',
  }
  return map[status] ?? 'NEEDS_WORK'
}

function aiSeverityToEnum(severity: string): Severity {
  const map: Record<string, Severity> = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO',
  }
  return map[severity] ?? 'MEDIUM'
}

/** Remove partial results before a retry or fresh persist. */
export async function clearAuditResults(auditId: string): Promise<void> {
  await prisma.$transaction([
    prisma.finding.deleteMany({ where: { auditId } }),
    prisma.auditArea.deleteMany({ where: { auditId } }),
  ])
}

export async function persistAuditResults(
  auditId: string,
  judgeOutput: JudgeOutput,
  deterministicFindings: DeterministicFinding[],
  areaScores: Partial<Record<AreaName, number | null>>
): Promise<void> {
  await clearAuditResults(auditId)

  await prisma.$transaction(async (tx) => {
    const areaRecords = await Promise.all(
      judgeOutput.areas.map((areaData) => {
        const areaName = areaData.name as AreaName
        const deterministicScore = areaScores[areaName]
        const finalScore = areaData.score ?? deterministicScore ?? undefined

        return tx.auditArea.create({
          data: {
            auditId,
            name: areaName,
            score: finalScore ?? null,
            grade: aiGradeToEnum(areaData.grade),
            status: aiStatusToEnum(areaData.status),
            summary: areaData.summary,
            areaPrompt: areaData.areaPrompt,
            cursorPrompt: areaData.cursorPrompt ?? null,
            claudePrompt: areaData.claudePrompt ?? null,
            lovablePrompt: areaData.lovablePrompt ?? null,
            boltPrompt: areaData.boltPrompt ?? null,
          },
        })
      })
    )

    const areaIdByName = new Map(areaRecords.map((record) => [record.name, record.id]))
    const enrichmentMap = new Map(judgeOutput.enrichments.map((e) => [e.checkId, e]))

    const findingRows = [
      ...deterministicFindings.map((f, i) => {
        const enrichment = enrichmentMap.get(f.checkId)
        return {
          auditId,
          areaId: areaIdByName.get(f.area as AreaName) ?? null,
          source: 'DETERMINISTIC' as FindingSource,
          area: f.area,
          severity: f.severity as Severity,
          problem: f.problem,
          evidence: f.evidence,
          whyItMatters:
            enrichment?.whyItMatters ??
            `This issue affects the ${f.area.toLowerCase()} quality of your page.`,
          fix: f.fix,
          confidence: f.confidence,
          agentPrompt: enrichment?.agentPrompt ?? null,
          cursorPrompt: enrichment?.cursorPrompt ?? null,
          claudePrompt: enrichment?.claudePrompt ?? null,
          lovablePrompt: enrichment?.lovablePrompt ?? null,
          boltPrompt: enrichment?.boltPrompt ?? null,
          verificationRule:
            enrichment?.verificationRule ??
            verificationRuleForCheckId(f.checkId) ??
            null,
          checkId: f.checkId,
          pageUrl: f.pageUrl ?? null,
          position: i,
        }
      }),
      ...judgeOutput.newFindings.map((f, i) => ({
        auditId,
        areaId: areaIdByName.get(f.area as AreaName) ?? null,
        source: 'AI' as FindingSource,
        area: f.area,
        severity: aiSeverityToEnum(f.severity),
        problem: f.problem,
        evidence: f.evidence,
        whyItMatters: f.whyItMatters ?? f.evidence,
        fix: f.fix,
        confidence: f.confidence,
        agentPrompt: f.agentPrompt ?? null,
        cursorPrompt: f.cursorPrompt ?? null,
        claudePrompt: f.claudePrompt ?? null,
        lovablePrompt: f.lovablePrompt ?? null,
        boltPrompt: f.boltPrompt ?? null,
        verificationRule: f.verificationRule ?? null,
        checkId: null,
        position: deterministicFindings.length + i,
      })),
    ]

    if (findingRows.length > 0) {
      await tx.finding.createMany({ data: findingRows })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        pageJob: judgeOutput.pageJob,
        pageType: judgeOutput.pageType,
        verdict: judgeOutput.verdict,
        score: judgeOutput.score,
        launchReadiness: {
          readiness: judgeOutput.launchReadiness,
          checklist: judgeOutput.launchChecklist,
        },
        completedAt: new Date(),
      },
    })
  })
}
