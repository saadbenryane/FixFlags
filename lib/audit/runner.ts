import { prisma } from '../db'
import { captureScreenshots } from './screenshot'
import { fetchAndParseMetadata } from './metadata'
import { fetchPageSpeedData } from './pagespeed'
import { runAllChecks, computeAreaScores } from './checks'
import { runJudge } from './judge'
import { AuditStatus, AreaName, AreaGrade, AreaStatus, Severity, FindingSource } from '@prisma/client'

const AREA_NAMES: AreaName[] = [
  'PERFORMANCE',
  'ACCESSIBILITY',
  'SEO',
  'CONVERSION',
  'TRUST',
  'CONTENT',
  'MOBILE',
]

function gradeFromScore(score: number | null): AreaGrade {
  if (score === null) return 'C'
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 50) return 'C'
  if (score >= 25) return 'D'
  return 'F'
}

function statusFromGrade(grade: AreaGrade): AreaStatus {
  if (grade === 'A') return 'EXCELLENT'
  if (grade === 'B') return 'GOOD'
  if (grade === 'C' || grade === 'D') return 'NEEDS_WORK'
  return 'CRITICAL'
}

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

export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)

  const url = audit.url

  // Phase 1 — Capture
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'CAPTURING', startedAt: new Date() },
  })

  let desktopBase64: string | null = null
  let mobileBase64: string | null = null
  let consoleErrors: Array<{ type: string; text: string }> = []

  try {
    const screenshots = await captureScreenshots(url, auditId)
    desktopBase64 = screenshots.desktopBase64
    mobileBase64 = screenshots.mobileBase64
    consoleErrors = screenshots.consoleErrors

    if (screenshots.desktopUrl) {
      await prisma.screenshot.create({
        data: {
          auditId,
          device: 'DESKTOP',
          url: screenshots.desktopUrl,
          width: 1280,
          height: 900,
        },
      })
    }
    if (screenshots.mobileUrl) {
      await prisma.screenshot.create({
        data: {
          auditId,
          device: 'MOBILE',
          url: screenshots.mobileUrl,
          width: 375,
          height: 812,
        },
      })
    }
  } catch (err) {
    console.error('Screenshot phase failed, continuing:', err)
  }

  // Fetch metadata + PageSpeed in parallel
  let metadata
  let pagespeed
  try {
    ;[metadata, pagespeed] = await Promise.all([
      fetchAndParseMetadata(url),
      fetchPageSpeedData(url),
    ])
  } catch (err) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'FAILED',
        errorMsg: `Failed to fetch page: ${(err as Error).message}`,
      },
    })
    throw err
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'CHECKING',
      htmlMetadata: metadata as never,
      performanceData: { desktop: pagespeed.desktop, mobile: pagespeed.mobile } as never,
      consoleErrors: consoleErrors as never,
    },
  })

  // Phase 2 — Deterministic checks
  const deterministicFindings = await runAllChecks(
    url,
    metadata,
    pagespeed.desktop,
    pagespeed.mobile,
    consoleErrors
  )

  const areaScores = computeAreaScores(deterministicFindings, pagespeed.desktop, pagespeed.mobile)

  // Phase 3 — AI judge
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING' },
  })

  let judgeOutput
  try {
    judgeOutput = await runJudge(
      url,
      metadata,
      pagespeed.desktop,
      pagespeed.mobile,
      deterministicFindings,
      desktopBase64,
      mobileBase64
    )
  } catch (err) {
    console.error('AI judge failed, using deterministic-only results:', err)
    // Fallback: create minimal areas from deterministic scores
    const fallbackAreas = AREA_NAMES.map((name) => {
      const score = areaScores[name]
      const grade = gradeFromScore(score)
      const findingsForArea = deterministicFindings.filter((f) => f.area === name)
      return {
        name,
        score: score ?? undefined,
        grade,
        status: statusFromGrade(grade),
        summary: findingsForArea.length > 0
          ? `${findingsForArea.length} issue${findingsForArea.length > 1 ? 's' : ''} found: ${findingsForArea[0].problem}`
          : 'No issues detected.',
        areaPrompt: findingsForArea.length > 0
          ? `Fix these ${name.toLowerCase()} issues:\n${findingsForArea.map((f) => `- ${f.fix}`).join('\n')}`
          : `The ${name.toLowerCase()} area looks good.`,
        cursorPrompt: undefined,
        claudePrompt: undefined,
        lovablePrompt: undefined,
        boltPrompt: undefined,
      }
    })

    const knownScores = Object.values(areaScores).filter(
      (s): s is number => s !== null && s !== undefined
    )
    judgeOutput = {
      pageJob: 'Serve website visitors',
      pageType: 'other' as const,
      verdict: 'Analysis completed with deterministic checks only. AI analysis was unavailable.',
      score: knownScores.length > 0
        ? Math.round(knownScores.reduce((a, b) => a + b, 0) / knownScores.length)
        : null,
      areas: fallbackAreas,
      newFindings: [],
      enrichments: [],
    }
  }

  // Persist everything
  const areaRecords = new Map<string, string>()

  for (const areaData of judgeOutput.areas) {
    const areaName = areaData.name as AreaName
    const deterministicScore = areaScores[areaName]
    const finalScore = areaData.score ?? deterministicScore ?? undefined
    const grade = aiGradeToEnum(areaData.grade)
    const status = aiStatusToEnum(areaData.status)

    const areaRecord = await prisma.auditArea.create({
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

  // Create deterministic findings with enrichments
  const enrichmentMap = new Map(judgeOutput.enrichments.map((e) => [e.checkId, e]))

  for (let i = 0; i < deterministicFindings.length; i++) {
    const f = deterministicFindings[i]
    const enrichment = enrichmentMap.get(f.checkId)
    const areaId = areaRecords.get(f.area)

    await prisma.finding.create({
      data: {
        auditId,
        areaId: areaId ?? null,
        source: 'DETERMINISTIC',
        area: f.area,
        severity: f.severity as Severity,
        problem: f.problem,
        evidence: f.evidence,
        whyItMatters: enrichment?.whyItMatters ?? `This issue affects the ${f.area.toLowerCase()} quality of your page.`,
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

  // Create AI-only findings
  for (let i = 0; i < judgeOutput.newFindings.length; i++) {
    const f = judgeOutput.newFindings[i]
    const areaId = areaRecords.get(f.area)

    await prisma.finding.create({
      data: {
        auditId,
        areaId: areaId ?? null,
        source: 'AI',
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

  await prisma.audit.update({
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
}
