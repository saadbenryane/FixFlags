import { flagKeyForRow } from './flag-key'
import { assertPrescriptionScope, guidanceHash, prescriptionHash, type PrescriptionScope } from './prescription-scope'
import { currentExecutionOwnership } from './execution-ownership'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import {
  Prisma,
  RubricName,
  Severity,
  RubricGrade,
  ImpactTag,
} from '@prisma/client'
import type { JudgeOutput } from './judge-schema'
import type { TriageOutput } from './judge-triage-schema'
import type { PrescriptionOutput } from './judge-prescription-schema'
import { verificationRuleForCheckId } from './verify-flags'
import { whyItMattersForCheckId } from './flag-copy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { SEARCH_CHECK_REGISTRY } from '@/lib/audit/search/definitions'
import {
  calculateOverallScore,
  clampScore,
  gradeFromScore,
  statusFromGrade,
  statusFromScore,
} from './scoring'
import { RUBRIC_ORDER } from './constants'
import { PIPELINE_PROGRESS } from './progress'
import { collapseFlagsWithAffectedPaths, flagFingerprint } from './flag-identity'
import { projectDeterministicFlags } from './flag-projection'
import type { DeterministicFlag, DeterministicFlagRow, AiFlagRow } from './flag-types'
import { groundedReportVerdict, groundedRubricSummary } from './verdict'
import { parseProductContract } from './product-contract'
import { observationsForFlag, mergeSupportingObservations, readSupportingObservations } from './flag-observations'
import { admitAiObservation, newAiObservationFingerprint } from './ai-observation-identity'

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
    attentionPolicy: flag.attentionPolicy as Prisma.InputJsonValue | undefined,
    problem: flag.problem,
    evidence: flag.evidence,
    supportingObservations: observationsForFlag(flag) as Prisma.InputJsonValue,
    whyItMatters:
      flag.attentionPolicy?.policy === 'search'
        ? SEARCH_COPY.consequences[SEARCH_CHECK_REGISTRY[flag.checkId.split('::page:')[0] as keyof typeof SEARCH_CHECK_REGISTRY]?.responsibility ?? 'presentation']
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
      flag.verificationRule ??
      verificationRuleForCheckId(flag.checkId) ??
      null,
    checkId: flag.checkId,
    pageUrl: flag.pageUrl ?? null,
    affectedPaths:
      flag.affectedPaths && flag.affectedPaths.length > 0
        ? (flag.affectedPaths as unknown as Prisma.InputJsonValue)
        : undefined,
    fingerprint: flagFingerprint(flag),
    position: i,
    evidenceTargets:
      flag.evidenceTargets && flag.evidenceTargets.length > 0
        ? (JSON.parse(JSON.stringify(flag.evidenceTargets)) as Prisma.InputJsonValue)
        : undefined,
  }
}

export function buildAiFlagRow(
  flag: JudgeOutput['newFlags'][number] & { fingerprint?: string | null; supportingObservations?: unknown },
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
    supportingObservations: observationsForFlag({ ...flag, source: 'AI' }) as Prisma.InputJsonValue,
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
    fingerprint: newAiObservationFingerprint(flag),
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

/** Stable projection identities; repeated publication never deletes originating evidence. */
async function persistFlagRows(tx: Prisma.TransactionClient, auditId: string, rows: Prisma.FlagCreateManyInput[], authoritativePaths = false) {
  await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
  const previous = await tx.flag.findMany({ where: { auditId, source: { in: ['DETERMINISTIC', 'AI'] } },
    select: { id: true, fingerprint: true, source: true, affectedPaths: true, supportingObservations: true } })
  const existing = new Map(previous.map(row => [row.source + ':' + row.fingerprint, row]))
  const created: Prisma.FlagCreateManyInput[] = []
  for (const row of rows) {
    const prior = existing.get(row.source + ':' + row.fingerprint)
    if (!prior) { created.push(row); continue }
    const paths = [...new Set([
      ...(!authoritativePaths && Array.isArray(prior.affectedPaths) ? prior.affectedPaths.filter((value): value is string => typeof value === 'string') : []),
      ...(Array.isArray(row.affectedPaths) ? row.affectedPaths.filter((value): value is string => typeof value === 'string') : []),
    ])]
    const oldObservations = readSupportingObservations(prior.supportingObservations)
    const newObservations = readSupportingObservations(row.supportingObservations)
    const supportingObservations = !authoritativePaths && oldObservations && newObservations
      ? mergeSupportingObservations([oldObservations, newObservations]) as Prisma.InputJsonValue : row.supportingObservations
    await tx.flag.update({ where: { id: prior.id }, data: { ...row, supportingObservations, affectedPaths: paths.length ? paths : undefined } })
  }
  if (created.length) await tx.flag.createMany({ data: created })
}

/** Soft score impact so journey findings affect rubric grades without double-counting checks. */
function journeySeverityPenalty(severity: string): number {
  switch (severity) {
    case 'CRITICAL':
      return 8
    case 'IMPORTANT':
      return 4
    case 'POLISH':
      return 1
    default:
      return 0
  }
}

/**
 * Persist deterministic flags and partial rubric scores during the pipeline run.
 * Incremental callers retain prior paths. Authoritative projection callers supply
 * every committed observation, including overlaps, to update the current union.
 */
export async function persistDeterministicFlags(
  auditId: string,
  deterministicFlags: DeterministicFlag[],
  rubricScores: Partial<Record<RubricName, number | null>>,
  transaction?: Prisma.TransactionClient,
  options: { authoritativeProjection?: boolean } = {},
): Promise<void> {
  const persist = async (tx: Prisma.TransactionClient) => {

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

    const collapsed = options.authoritativeProjection ? projectDeterministicFlags(deterministicFlags) : collapseFlagsWithAffectedPaths(deterministicFlags)
    const flagRows = collapsed.map((f, i) => ({
      ...buildDeterministicFlagRow(f, i, pageIdByUrl, rubricIdByName),
      auditId,
    }))

    await persistFlagRows(tx, auditId, flagRows, options.authoritativeProjection)
    if (options.authoritativeProjection) {
      const retained = new Set(collapsed.map(flagFingerprint))
      const superseded = [...new Set(deterministicFlags.map(flagFingerprint))].filter(identity => !retained.has(identity))
      // Only transient duplicate projection rows can disappear. Source receipts,
      // completed reports and findings tied to customer actions are retained.
      if (superseded.length) await tx.flag.deleteMany({ where: {
        auditId, source: 'DETERMINISTIC', fingerprint: { in: superseded }, status: 'OPEN', resolvedInId: null,
        issueId: null, feedback: { none: {} }, improvementOccurrence: { is: null },
        audit: { finalizedAt: null, status: { notIn: ['COMPLETED', 'FAILED'] } },
      } })
    }

    const overallScore = calculateOverallScore(rubricScores)
    await tx.audit.update({
      where: { id: auditId },
      data: {
        score: overallScore,
        reportCompleteness: 'PARTIAL',
      },
    })
  }
  if (transaction) await persist(transaction)
  else await executionTransaction(persist)
}

export function buildTriageAiFlagRow(
  flag: TriageOutput['newFlags'][number] & { fingerprint?: string | null; supportingObservations?: unknown },
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
    supportingObservations: observationsForFlag({ ...flag, source: 'AI' }) as Prisma.InputJsonValue,
    rubric: flag.rubric,
    impactTag: aiImpactToEnum(flag.impactTag),
    severity: aiSeverityToEnum(flag.severity),
    problem: flag.problem,
    evidence: flag.evidence.trim(),
    whyItMatters: flag.whyItMatters.trim(),
    // Fix prompts stay empty until prescription / claim unlock. Use '' so the
    // non-null Flag.fix column stays valid without persisting gate copy.
    fix: '',
    confidence: flag.confidence,
    agentPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    windsurfPrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: null,
    checkId: null,
    pageUrl: flag.pageUrl ?? null,
    affectedPaths:
      'affectedPaths' in flag && Array.isArray(flag.affectedPaths) && flag.affectedPaths.length > 0
        ? (flag.affectedPaths as unknown as Prisma.InputJsonValue)
        : undefined,
    fingerprint: newAiObservationFingerprint(flag),
    position: positionOffset + i,
  }
}

export { flagKeyForRow } from './flag-key'

/** Treats null, empty, and whitespace-only strings as blank. */
export function isBlankText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

export type RecordedTriage = Readonly<{ kind: 'recorded-triage'; version: 1; auditId: string }>

export async function persistTriageResults(
  auditId: string,
  triageOutput: TriageOutput,
  deterministicFlags: DeterministicFlag[],
  rubricScores: Partial<Record<RubricName, number | null>>
): Promise<RecordedTriage> {

  await executionTransaction(async (tx) => {
    const pages = await tx.auditPage.findMany({
      where: { auditId },
      select: { id: true, normalizedUrl: true },
    })
    const pageIdByUrl = new Map(pages.map((page) => [page.normalizedUrl, page.id]))
    const resolvedScores: Partial<Record<RubricName, number | null>> = {}
    const resolvedGrades: Partial<Record<RubricName, RubricGrade | null>> = {}

    const journeyFlags = await tx.flag.findMany({
      where: { auditId, source: 'JOURNEY' },
      select: {
        id: true,
        rubric: true,
        severity: true,
        problem: true,
        whyItMatters: true,
        checkId: true,
        impactTag: true,
        confidence: true,
      },
    })
    const auditContract = await tx.audit.findUnique({
      where: { id: auditId },
      select: { productContract: true },
    })
    const productContract = parseProductContract(auditContract?.productContract)
    const judgmentFlags = [
      ...deterministicFlags,
      ...triageOutput.newFlags,
      ...journeyFlags,
    ]
    const journeyPenaltyByRubric: Partial<Record<RubricName, number>> = {}
    for (const flag of journeyFlags) {
      const rubricName = flag.rubric as RubricName
      journeyPenaltyByRubric[rubricName] =
        (journeyPenaltyByRubric[rubricName] ?? 0) + journeySeverityPenalty(flag.severity)
    }

    const rubricRecords = await Promise.all(
      triageOutput.rubrics.map((rubricData) => {
        const rubricName = rubricData.name as RubricName
        const deterministicScore = rubricScores[rubricName]

        let finalScore =
          deterministicScore !== null && deterministicScore !== undefined
            ? clampScore(deterministicScore)
            : rubricData.score !== null
              ? clampScore(rubricData.score)
              : null
        if (finalScore !== null) {
          const penalty = journeyPenaltyByRubric[rubricName] ?? 0
          if (penalty > 0) finalScore = clampScore(finalScore - penalty)
        }
        const finalGrade =
          finalScore !== null ? gradeFromScore(finalScore) : rubricData.grade

        resolvedScores[rubricName] = finalScore
        resolvedGrades[rubricName] = finalGrade

        const data: Prisma.ReportRubricUncheckedCreateInput = {
            auditId,
            name: rubricName,
            score: finalScore,
            grade: finalGrade,
            status:
              finalScore === null ? statusFromGrade(finalGrade) : statusFromScore(finalScore),
            assessmentState: finalScore === null ? rubricData.assessmentState : 'ASSESSED',
            confidence: rubricData.confidence,
            summary: groundedRubricSummary(
              rubricName,
              judgmentFlags,
              finalGrade,
              productContract
            ),
            rubricPrompt: '',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
        }
        return tx.reportRubric.upsert({ where: { auditId_name: { auditId, name: rubricName } }, create: data, update: data })
      })
    )

    const rubricIdByName = new Map(rubricRecords.map((record) => [record.name, record.id]))

    const collapsedDeterministic = collapseFlagsWithAffectedPaths(deterministicFlags)
    const collapsedAi = collapseFlagsWithAffectedPaths(triageOutput.newFlags.map(flag => ({ ...admitAiObservation(flag), source: 'AI' })))

    const flagRows = [
      ...collapsedDeterministic.map((f, i) => ({
        ...buildDeterministicFlagRow(f, i, pageIdByUrl, rubricIdByName),
        auditId,
      })),
      ...collapsedAi.map((f, i) => ({
        ...buildTriageAiFlagRow(
          f,
          i,
          pageIdByUrl,
          rubricIdByName,
          collapsedDeterministic.length
        ),
        auditId,
      })),
    ]

    await persistFlagRows(tx, auditId, flagRows)

    const overallScore = calculateOverallScore(resolvedScores, resolvedGrades)
    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: 'FINALIZING',
        progress: PIPELINE_PROGRESS.FINALIZING_PERSIST,
        pageJob: triageOutput.pageJob,
        pageType: triageOutput.pageType,
        verdict: groundedReportVerdict(
          judgmentFlags,
          RUBRIC_ORDER.map((name) => ({ name, grade: resolvedGrades[name] ?? null })),
          productContract
        ),
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
  return { kind: 'recorded-triage', version: 1, auditId }
}

export async function mergePrescriptionResults(
  auditId: string,
  prescription: PrescriptionOutput,
  options?: { rubrics?: boolean; scope?: PrescriptionScope }
): Promise<void> {
  await executionTransaction(async (tx) => {
    const flags = await tx.flag.findMany({ where: { auditId } })
    if (options?.scope) {
      assertPrescriptionScope(options.scope, flags)
      const expected = new Set(options.scope.members.map(member => member.key))
      const received = prescription.flagPrescriptions.map(item => item.flagKey)
      if (received.length !== expected.size || new Set(received).size !== expected.size || received.some(key => !expected.has(key)))
        throw new Error('PRESCRIPTION_MEMBERSHIP_INVALID')
    }
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
      // Prescription owns repair guidance only. Recorded diagnosis, evidence and
      // verification obligations belong to their original assessment for every source.

      await tx.flag.update({
        where: { id: flag.id },
        data: {
          fix: item.fix,
          agentPrompt: item.agentPrompt ?? null,
          cursorPrompt: item.cursorPrompt ?? null,
          claudePrompt: item.claudePrompt ?? null,
          windsurfPrompt: item.windsurfPrompt ?? null,
          lovablePrompt: item.lovablePrompt ?? null,
          boltPrompt: item.boltPrompt ?? null,
        },
      })
    }

    if (options?.scope) {
      const owner = currentExecutionOwnership()
      if (!owner?.taskId || owner.auditId !== auditId) throw new Error('Prescription commit requires its execution task')
      const selected = await tx.flag.findMany({ where: { auditId, id: { in: options.scope.members.map(member => member.id) } } })
      await tx.auditPipelineEvent.create({ data: { auditId, executionId: owner.taskId, traceId: auditId,
        attempt: owner?.generation ?? 1, stage: 'judging', event: 'prescription_guidance_committed', status: 'completed',
        detail: { version: 1, scopeHash: prescriptionHash(options.scope), guidance: selected.map(flag => ({ id: flag.id, hash: guidanceHash(flag) })) } } })
    }

    if (options?.rubrics === false) return

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

    // Enrichment does not reopen the completed analysis. The durable prescription
    // task owns its progress and can retry after this transaction commits.
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
