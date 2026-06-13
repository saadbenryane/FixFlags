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
    const areaRecords = new Map<string, string>()

    for (const areaData of judgeOutput.areas) {
      const areaName = areaData.name as AreaName
      const deterministicScore = areaScores[areaName]
      const finalScore = areaData.score ?? deterministicScore ?? undefined
      const grade = aiGradeToEnum(areaData.grade)
      const status = aiStatusToEnum(areaData.status)

      const areaRecord = await tx.auditArea.create({
        data: {
          auditId,
          name: areaName,
          score: finalScore ?? null,
          grade,
          status,
          summary: areaData.summary,
          areaPrompt: areaData.areaPrompt,
          cursorPrompt: areaData.cursorPrompt ?? null,
          claudePrompt: areaData.claudePrompt ?? null,
          lovablePrompt: areaData.lovablePrompt ?? null,
          boltPrompt: areaData.boltPrompt ?? null,
        },
      })

      areaRecords.set(areaName, areaRecord.id)
    }

    const enrichmentMap = new Map(judgeOutput.enrichments.map((e) => [e.checkId, e]))

    for (let i = 0; i < deterministicFindings.length; i++) {
      const f = deterministicFindings[i]
      const enrichment = enrichmentMap.get(f.checkId)
      const areaId = areaRecords.get(f.area)

      await tx.finding.create({
        data: {
          auditId,
          areaId: areaId ?? null,
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
          verificationRule: enrichment?.verificationRule ?? null,
          checkId: f.checkId,
          position: i,
        },
      })
    }

    for (let i = 0; i < judgeOutput.newFindings.length; i++) {
      const f = judgeOutput.newFindings[i]
      const areaId = areaRecords.get(f.area)

      await tx.finding.create({
        data: {
          auditId,
          areaId: areaId ?? null,
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
        },
      })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        pageJob: judgeOutput.pageJob,
        pageType: judgeOutput.pageType,
        verdict: judgeOutput.verdict,
        score: judgeOutput.score,
        completedAt: new Date(),
      },
    })
  })
}
