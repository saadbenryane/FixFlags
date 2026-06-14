import { prisma } from '@/lib/db'
import { AreaName, Severity, FindingSource, AreaGrade } from '@prisma/client'
import { DeterministicFinding } from './checks'
import { JudgeOutput } from './judge'
import { verificationRuleForCheckId } from './verify-findings'
import {
  calculateOverallScore,
  clampScore,
  gradeFromScore,
  isSubjectiveArea,
  statusFromGrade,
  statusFromScore,
} from './scoring'
import { AREA_ORDER } from './constants'
import { deduplicateFindings, findingFingerprint } from './deduplicate'

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

/** Persist deterministic findings and partial area scores during the pipeline run. */
export async function persistDeterministicFindings(
  auditId: string,
  deterministicFindings: DeterministicFinding[],
  areaScores: Partial<Record<AreaName, number | null>>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.finding.deleteMany({
      where: { auditId, source: 'DETERMINISTIC' },
    })

    const pages = await tx.auditPage.findMany({
      where: { auditId },
      select: { id: true, normalizedUrl: true },
    })
    const pageIdByUrl = new Map(pages.map((page) => [page.normalizedUrl, page.id]))

    const areaRecords = await Promise.all(
      AREA_ORDER.map(async (areaName) => {
        const score = areaScores[areaName]
        const existing = await tx.auditArea.findFirst({
          where: { auditId, name: areaName },
        })
        if (existing) {
          return tx.auditArea.update({
            where: { id: existing.id },
            data: {
              score: score !== null && score !== undefined ? clampScore(score) : null,
              grade:
                score !== null && score !== undefined ? gradeFromScore(clampScore(score)) : null,
              status:
                score !== null && score !== undefined
                  ? statusFromScore(clampScore(score))
                  : null,
              assessmentState:
                score !== null && score !== undefined ? 'ASSESSED' : 'PARTIAL',
              summary:
                existing.summary ||
                `Partial ${areaName.toLowerCase()} assessment from automated checks.`,
            },
          })
        }
        return tx.auditArea.create({
          data: {
            auditId,
            name: areaName,
            score: score !== null && score !== undefined ? clampScore(score) : null,
            grade:
              score !== null && score !== undefined ? gradeFromScore(clampScore(score)) : null,
            status:
              score !== null && score !== undefined ? statusFromScore(clampScore(score)) : null,
            assessmentState: score !== null && score !== undefined ? 'ASSESSED' : 'PARTIAL',
            confidence: 0.7,
            summary: `Partial ${areaName.toLowerCase()} assessment from automated checks.`,
            areaPrompt: `Review ${areaName.toLowerCase()} findings and apply fixes.`,
          },
        })
      })
    )

    const areaIdByName = new Map(areaRecords.map((record) => [record.name, record.id]))

    const findingRows = deterministicFindings.map((f, i) => ({
      auditId,
      pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
      areaId: areaIdByName.get(f.area as AreaName) ?? null,
      source: 'DETERMINISTIC' as FindingSource,
      area: f.area,
      severity: f.severity as Severity,
      problem: f.problem,
      evidence: f.evidence,
      whyItMatters: `This issue affects the ${f.area.toLowerCase()} quality of your page.`,
      fix: f.fix,
      confidence: f.confidence,
      verificationRule: verificationRuleForCheckId(f.checkId) ?? null,
      checkId: f.checkId,
      pageUrl: f.pageUrl ?? null,
      fingerprint: findingFingerprint(f),
      position: i,
    }))

    if (findingRows.length > 0) {
      await tx.finding.createMany({ data: findingRows })
    }

    const overallScore = calculateOverallScore(areaScores)
    await tx.audit.update({
      where: { id: auditId },
      data: {
        score: overallScore,
        reportCompleteness: 'PARTIAL',
      },
    })
  })
}

export async function persistAuditResults(
  auditId: string,
  judgeOutput: JudgeOutput,
  deterministicFindings: DeterministicFinding[],
  areaScores: Partial<Record<AreaName, number | null>>
): Promise<void> {
  await clearAuditResults(auditId)

  await prisma.$transaction(async (tx) => {
    const pages = await tx.auditPage.findMany({
      where: { auditId },
      select: { id: true, normalizedUrl: true },
    })
    const pageIdByUrl = new Map(pages.map((page) => [page.normalizedUrl, page.id]))
    const resolvedScores: Partial<Record<AreaName, number | null>> = {}
    const resolvedGrades: Partial<Record<AreaName, AreaGrade | null>> = {}
    const areaRecords = await Promise.all(
      judgeOutput.areas.map((areaData) => {
        const areaName = areaData.name as AreaName
        const subjective = isSubjectiveArea(areaName)
        const deterministicScore = areaScores[areaName]

        let finalScore: number | null
        let finalGrade: AreaGrade

        if (subjective) {
          finalScore = null
          finalGrade = areaData.grade
        } else {
          finalScore =
            deterministicScore !== null && deterministicScore !== undefined
              ? clampScore(deterministicScore)
              : areaData.score !== null
                ? clampScore(areaData.score)
                : null
          finalGrade =
            finalScore !== null ? gradeFromScore(finalScore) : areaData.grade
        }

        resolvedScores[areaName] = finalScore
        resolvedGrades[areaName] = finalGrade

        return tx.auditArea.create({
          data: {
            auditId,
            name: areaName,
            score: finalScore,
            grade: finalGrade,
            status: subjective
              ? statusFromGrade(finalGrade)
              : finalScore === null
                ? null
                : statusFromScore(finalScore),
            assessmentState: finalScore === null && !subjective ? areaData.assessmentState : 'ASSESSED',
            confidence: areaData.confidence,
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
    const aiFindings = deduplicateFindings(deterministicFindings, judgeOutput.newFindings)

    const findingRows = [
      ...deterministicFindings.map((f, i) => {
        const enrichment = enrichmentMap.get(f.checkId)
        return {
          auditId,
          pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
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
          fingerprint: findingFingerprint(f),
          position: i,
        }
      }),
      ...aiFindings.map((f, i) => ({
        auditId,
        pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
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
        verificationRule: f.verificationRule ?? 'Confirm the issue described in evidence on the live page.',
        checkId: null,
        pageUrl: f.pageUrl ?? null,
        fingerprint: findingFingerprint(f),
        position: deterministicFindings.length + i,
      })),
    ]

    if (findingRows.length > 0) {
      await tx.finding.createMany({ data: findingRows })
    }

    const overallScore = calculateOverallScore(resolvedScores, resolvedGrades)
    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: 'FINALIZING',
        progress: 95,
        pageJob: judgeOutput.pageJob,
        pageType: judgeOutput.pageType,
        verdict: judgeOutput.verdict,
        score: overallScore,
        launchReadiness: {
          readiness: judgeOutput.launchReadiness,
          checklist: judgeOutput.launchChecklist,
        },
        launchReadinessState: judgeOutput.launchReadiness.toUpperCase() as
          | 'SAFE'
          | 'FIX_FIRST'
          | 'NOT_READY',
      },
    })
  })
}
