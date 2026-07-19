import { prisma } from '@/lib/db'
import {
  RubricName,
  Severity,
  RubricGrade,
  ImpactTag,
} from '@prisma/client'
import type { JudgeOutput } from './judge-schema'
import type { TriageOutput } from './judge-triage-schema'
import type { PrescriptionOutput } from './judge-prescription-schema'
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
import { flagFingerprint } from './deduplicate'
import type { DeterministicFlag, DeterministicFlagRow, AiFlagRow } from './flag-types'

export type { DeterministicFlagRow, AiFlagRow } from './flag-types'

export function buildDeterministicFlagRow(
  flag: DeterministicFlag,
  i: number,
  pageIdByUrl: Map<string, string>,
  rubricIdByName: Map<string, string>,
  enrichment?: JudgeOutput['enrichments'][number]
): DeterministicFlagRow {
  return {
    auditId: '', // filled by caller
    pageId: flag.pageUrl ? pageIdByUrl.get(new URL(flag.pageUrl).toString()) ?? null : null,
    rubricId: rubricIdByName.get(flag.rubric) ?? null,
    source: 'DETERMINISTIC',
    rubric: flag.rubric,
    impactTag: flag.impactTag ? (flag.impactTag as ImpactTag) : null,
    severity: flag.severity as Severity,
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters:
      enrichment?.whyItMatters && !isGenericWhyItMatters(enrichment.whyItMatters)
        ? enrichment.whyItMatters
        : whyItMattersForCheckId(flag.checkId),
    fix: flag.fix,
    confidence: flag.confidence,
    agentPrompt: enrichment?.agentPrompt ?? null,
    cursorPrompt: enrichment?.cursorPrompt ?? null,
    claudePrompt: enrichment?.claudePrompt ?? null,
    windsurfPrompt: enrichment?.windsurfPrompt ?? null,
    lovablePrompt: enrichment?.lovablePrompt ?? null,
    boltPrompt: enrichment?.boltPrompt ?? null,
    verificationRule:
      enrichment?.verificationRule ??
      verificationRuleForCheckId(flag.checkId) ??
      null,
    checkId: flag.checkId,
    pageUrl: flag.pageUrl ?? null,
    fingerprint: flagFingerprint(flag),
    position: i,
  }
}

export function buildAiFlagRow(
  flag: JudgeOutput['newFlags'][number],
  i: number,
  pageIdByUrl: Map<string, string>,
  rubricIdByName: Map<string, string>,
  positionOffset: number
): AiFlagRow {
  return {
    auditId: '',
    pageId: flag.pageUrl ? pageIdByUrl.get(new URL(flag.pageUrl).toString()) ?? null : null,
    rubricId: rubricIdByName.get(flag.rubric) ?? null,
    source: 'AI',
    rubric: flag.rubric,
    impactTag: aiImpactToEnum(flag.impactTag),
    severity: aiSeverityToEnum(flag.severity),
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters ?? flag.evidence,
    fix: flag.fix,
    confidence: flag.confidence,
    agentPrompt: flag.agentPrompt ?? null,
    cursorPrompt: flag.cursorPrompt ?? null,
    claudePrompt: flag.claudePrompt ?? null,
    windsurfPrompt: flag.windsurfPrompt ?? null,
    lovablePrompt: flag.lovablePrompt ?? null,
    boltPrompt: flag.boltPrompt ?? null,
    verificationRule: flag.verificationRule ?? 'Confirm the issue described in evidence on the live page.',
    checkId: null,
    pageUrl: flag.pageUrl ?? null,
    fingerprint: flagFingerprint(flag),
    position: positionOffset + i,
  }
}

export function aiSeverityToEnum(severity: string): Severity {
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

export function aiImpactToEnum(tag: string | null | undefined): ImpactTag | null {
  if (!tag) return null
  const valid: ImpactTag[] = [
    'CONVERSION',
    'REVENUE',
    'TRUST',
    'MEASUREMENT',
    'SHARING',
    'SEO',
    'ACCESSIBILITY',
    'CLARITY',
    'AUTHORITY',
    'FRICTION',
    'EMOTION',
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
      ...buildDeterministicFlagRow(f, i, pageIdByUrl, rubricIdByName),
      auditId,
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

const TRIAGE_LOCKED_EVIDENCE = 'Create a free account to see evidence and fix prompts.'
const TRIAGE_LOCKED_WHY = 'Sign up to see why this matters and get a copy-paste fix prompt.'
const TRIAGE_LOCKED_FIX = 'Sign up to get the copy-paste fix prompt.'

export function buildTriageAiFlagRow(
  flag: TriageOutput['newFlags'][number],
  i: number,
  pageIdByUrl: Map<string, string>,
  rubricIdByName: Map<string, string>,
  positionOffset: number
): AiFlagRow {
  return {
    auditId: '',
    pageId: flag.pageUrl ? pageIdByUrl.get(new URL(flag.pageUrl).toString()) ?? null : null,
    rubricId: rubricIdByName.get(flag.rubric) ?? null,
    source: 'AI',
    rubric: flag.rubric,
    impactTag: aiImpactToEnum(flag.impactTag),
    severity: aiSeverityToEnum(flag.severity),
    problem: flag.problem,
    evidence: TRIAGE_LOCKED_EVIDENCE,
    whyItMatters: TRIAGE_LOCKED_WHY,
    fix: TRIAGE_LOCKED_FIX,
    confidence: flag.confidence,
    agentPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    windsurfPrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: 'Sign up to see verification steps.',
    checkId: null,
    pageUrl: flag.pageUrl ?? null,
    fingerprint: flagFingerprint(flag),
    position: positionOffset + i,
  }
}

export function flagKeyForRow(flag: {
  checkId: string | null
  fingerprint: string | null
}): string {
  return flag.checkId ?? flag.fingerprint ?? ''
}

/** Treats null, empty, and whitespace-only strings as blank. */
export function isBlankText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

export async function persistTriageResults(
  auditId: string,
  triageOutput: TriageOutput,
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
      triageOutput.rubrics.map((rubricData) => {
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
            rubricPrompt: '',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
          },
        })
      })
    )

    const rubricIdByName = new Map(rubricRecords.map((record) => [record.name, record.id]))

    const flagRows = [
      ...deterministicFlags.map((f, i) => ({
        ...buildDeterministicFlagRow(f, i, pageIdByUrl, rubricIdByName),
        auditId,
      })),
      ...triageOutput.newFlags.map((f, i) => ({
        ...buildTriageAiFlagRow(
          f,
          i,
          pageIdByUrl,
          rubricIdByName,
          deterministicFlags.length
        ),
        auditId,
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
        pageJob: triageOutput.pageJob,
        pageType: triageOutput.pageType,
        verdict: triageOutput.verdict,
        score: overallScore,
        launchReadiness: {
          readiness: triageOutput.launchReadiness,
          checklist: triageOutput.launchChecklist,
        },
        launchReadinessState: triageOutput.launchReadiness.toUpperCase() as
          | 'SAFE'
          | 'FIX_FIRST'
          | 'NOT_READY',
      },
    })
  })
}

export async function mergePrescriptionResults(
  auditId: string,
  prescription: PrescriptionOutput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const flags = await tx.flag.findMany({ where: { auditId } })
    const prescriptionByKey = new Map(
      prescription.flagPrescriptions.map((item) => [item.flagKey, item])
    )

    for (const flag of flags) {
      const key = flagKeyForRow(flag)
      const item = prescriptionByKey.get(key)
      if (!item) continue
      // Discard a degenerate prescription rather than blanking a flag: the
      // schema's `.min(1)` accepts whitespace-only evidence, which would
      // otherwise overwrite real triage content with an empty string.
      if (isBlankText(item.evidence)) continue

      await tx.flag.update({
        where: { id: flag.id },
        data: {
          evidence: item.evidence,
          whyItMatters: item.whyItMatters,
          fix: item.fix,
          agentPrompt: item.agentPrompt ?? null,
          cursorPrompt: item.cursorPrompt ?? null,
          claudePrompt: item.claudePrompt ?? null,
          windsurfPrompt: item.windsurfPrompt ?? null,
          lovablePrompt: item.lovablePrompt ?? null,
          boltPrompt: item.boltPrompt ?? null,
          verificationRule: item.verificationRule,
        },
      })
    }

    for (const rubricRx of prescription.rubricPrescriptions) {
      await tx.reportRubric.updateMany({
        where: { auditId, name: rubricRx.name as RubricName },
        data: {
          rubricPrompt: rubricRx.rubricPrompt,
          cursorPrompt: rubricRx.cursorPrompt ?? null,
          claudePrompt: rubricRx.claudePrompt ?? null,
          windsurfPrompt: rubricRx.windsurfPrompt ?? null,
          lovablePrompt: rubricRx.lovablePrompt ?? null,
          boltPrompt: rubricRx.boltPrompt ?? null,
        },
      })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: { status: 'FINALIZING', progress: 95 },
    })
  })
}
