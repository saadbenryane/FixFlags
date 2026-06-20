import { prisma } from '@/lib/db'
import {
  RubricName,
  Severity,
  FlagSource,
  RubricGrade,
  ImpactTag,
} from '@prisma/client'
import { DeterministicFlag } from './checks'
import type { JudgeOutput } from './judge-schema'
import { verificationRuleForCheckId } from './verify-flags'
import { whyItMattersForCheckId, isGenericWhyItMatters } from './flag-copy'
import {
  calculateOverallScore,
  clampScore,
  gradeFromScore,
  statusFromGrade,
  statusFromScore,
} from './scoring'
import { RUBRIC_ORDER } from './constants'
import { deduplicateFlags, flagFingerprint } from './deduplicate'

function aiSeverityToEnum(severity: string): Severity {
  const map: Record<string, Severity> = {
    CRITICAL: 'CRITICAL',
    IMPORTANT: 'IMPORTANT',
    POLISH: 'POLISH',
    HIGH: 'IMPORTANT',
    MEDIUM: 'POLISH',
    LOW: 'POLISH',
    INFO: 'POLISH',
  }
  return map[severity] ?? 'POLISH'
}

function aiImpactToEnum(tag: string | null | undefined): ImpactTag | null {
  if (!tag) return null
  const valid: ImpactTag[] = [
    'CONVERSION',
    'REVENUE',
    'TRUST',
    'MEASUREMENT',
    'SHARING',
    'SEO',
    'ACCESSIBILITY',
  ]
  return valid.includes(tag as ImpactTag) ? (tag as ImpactTag) : null
}

/** Remove partial results before a retry or fresh persist. */
export async function clearAuditResults(auditId: string): Promise<void> {
  await prisma.$transaction([
    prisma.flag.deleteMany({ where: { auditId } }),
    prisma.reportRubric.deleteMany({ where: { auditId } }),
  ])
}

/** Persist deterministic flags and partial rubric scores during the pipeline run. */
export async function persistDeterministicFlags(
  auditId: string,
  deterministicFlags: DeterministicFlag[],
  rubricScores: Partial<Record<RubricName, number | null>>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.flag.deleteMany({
      where: { auditId, source: 'DETERMINISTIC' },
    })

    const pages = await tx.auditPage.findMany({
      where: { auditId },
      select: { id: true, normalizedUrl: true },
    })
    const pageIdByUrl = new Map(pages.map((page) => [page.normalizedUrl, page.id]))

    const rubricRecords = await Promise.all(
      RUBRIC_ORDER.map(async (rubricName) => {
        const score = rubricScores[rubricName as RubricName]
        const existing = await tx.reportRubric.findFirst({
          where: { auditId, name: rubricName as RubricName },
        })
        if (existing) {
          return tx.reportRubric.update({
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
                `Partial ${rubricName.toLowerCase()} assessment from automated checks.`,
            },
          })
        }
        return tx.reportRubric.create({
          data: {
            auditId,
            name: rubricName as RubricName,
            score: score !== null && score !== undefined ? clampScore(score) : null,
            grade:
              score !== null && score !== undefined ? gradeFromScore(clampScore(score)) : null,
            status:
              score !== null && score !== undefined ? statusFromScore(clampScore(score)) : null,
            assessmentState: score !== null && score !== undefined ? 'ASSESSED' : 'PARTIAL',
            confidence: 0.7,
            summary: `Partial ${rubricName.toLowerCase()} assessment from automated checks.`,
            rubricPrompt: `Review ${rubricName.toLowerCase()} flags and apply fixes.`,
          },
        })
      })
    )

    const rubricIdByName = new Map(rubricRecords.map((record) => [record.name, record.id]))

    const flagRows = deterministicFlags.map((f, i) => ({
      auditId,
      pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
      rubricId: rubricIdByName.get(f.rubric as RubricName) ?? null,
      source: 'DETERMINISTIC' as FlagSource,
      rubric: f.rubric,
      impactTag: f.impactTag ? (f.impactTag as ImpactTag) : null,
      severity: f.severity as Severity,
      problem: f.problem,
      evidence: f.evidence,
      whyItMatters: whyItMattersForCheckId(f.checkId),
      fix: f.fix,
      confidence: f.confidence,
      verificationRule: verificationRuleForCheckId(f.checkId) ?? null,
      checkId: f.checkId,
      pageUrl: f.pageUrl ?? null,
      fingerprint: flagFingerprint(f),
      position: i,
    }))

    if (flagRows.length > 0) {
      await tx.flag.createMany({ data: flagRows })
    }

    const overallScore = calculateOverallScore(rubricScores)
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
  deterministicFlags: DeterministicFlag[],
  rubricScores: Partial<Record<RubricName, number | null>>
): Promise<void> {
  await clearAuditResults(auditId)

  await prisma.$transaction(async (tx) => {
    const pages = await tx.auditPage.findMany({
      where: { auditId },
      select: { id: true, normalizedUrl: true },
    })
    const pageIdByUrl = new Map(pages.map((page) => [page.normalizedUrl, page.id]))
    const resolvedScores: Partial<Record<RubricName, number | null>> = {}
    const resolvedGrades: Partial<Record<RubricName, RubricGrade | null>> = {}

    const rubricRecords = await Promise.all(
      judgeOutput.rubrics.map((rubricData) => {
        const rubricName = rubricData.name as RubricName
        const deterministicScore = rubricScores[rubricName]

        const finalScore =
          deterministicScore !== null && deterministicScore !== undefined
            ? clampScore(deterministicScore)
            : rubricData.score !== null
              ? clampScore(rubricData.score)
              : null
        const finalGrade =
          finalScore !== null ? gradeFromScore(finalScore) : rubricData.grade

        resolvedScores[rubricName] = finalScore
        resolvedGrades[rubricName] = finalGrade

        return tx.reportRubric.create({
          data: {
            auditId,
            name: rubricName,
            score: finalScore,
            grade: finalGrade,
            status:
              finalScore === null ? statusFromGrade(finalGrade) : statusFromScore(finalScore),
            assessmentState: finalScore === null ? rubricData.assessmentState : 'ASSESSED',
            confidence: rubricData.confidence,
            summary: rubricData.summary,
            rubricPrompt: rubricData.rubricPrompt,
            cursorPrompt: rubricData.cursorPrompt ?? null,
            claudePrompt: rubricData.claudePrompt ?? null,
            lovablePrompt: rubricData.lovablePrompt ?? null,
            boltPrompt: rubricData.boltPrompt ?? null,
          },
        })
      })
    )

    const rubricIdByName = new Map(rubricRecords.map((record) => [record.name, record.id]))
    const enrichmentMap = new Map(judgeOutput.enrichments.map((e) => [e.checkId, e]))
    const aiFlags = deduplicateFlags(deterministicFlags, judgeOutput.newFlags)

    const flagRows = [
      ...deterministicFlags.map((f, i) => {
        const enrichment = enrichmentMap.get(f.checkId)
        return {
          auditId,
          pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
          rubricId: rubricIdByName.get(f.rubric as RubricName) ?? null,
          source: 'DETERMINISTIC' as FlagSource,
          rubric: f.rubric,
          impactTag: f.impactTag ? (f.impactTag as ImpactTag) : null,
          severity: f.severity as Severity,
          problem: f.problem,
          evidence: f.evidence,
          whyItMatters:
            enrichment?.whyItMatters && !isGenericWhyItMatters(enrichment.whyItMatters)
              ? enrichment.whyItMatters
              : whyItMattersForCheckId(f.checkId),
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
          fingerprint: flagFingerprint(f),
          position: i,
        }
      }),
      ...aiFlags.map((f, i) => ({
        auditId,
        pageId: f.pageUrl ? pageIdByUrl.get(new URL(f.pageUrl).toString()) ?? null : null,
        rubricId: rubricIdByName.get(f.rubric as RubricName) ?? null,
        source: 'AI' as FlagSource,
        rubric: f.rubric,
        impactTag: aiImpactToEnum(f.impactTag),
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
        fingerprint: flagFingerprint(f),
        position: deterministicFlags.length + i,
      })),
    ]

    if (flagRows.length > 0) {
      await tx.flag.createMany({ data: flagRows })
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
