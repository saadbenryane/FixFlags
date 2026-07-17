import { prisma } from '@/lib/db'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { DEFAULT_SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  computeShareStatusFromRubrics,
  computeRubricsFromRows,
  type RubricComputed,
  type ShareStatus,
} from '@/lib/audit/rubric'
import { buildReportShapeFromDb, type ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'

const sampleInclude = {
  rubrics: {
    orderBy: { name: 'asc' } as const,
    include: { flags: { orderBy: { position: 'asc' } as const } },
  },
  flags: {
    orderBy: { position: 'asc' } as const,
  },
  screenshots: {
    where: { page: { position: 0 } },
    orderBy: { device: 'asc' } as const,
  },
}

/** Marketing sample provenance. Prefer live curated audits; fixture is offline/demo only. */
export type SampleSource = 'live' | 'curated' | 'fixture'

export type LiveSampleAudit = {
  id: string
  url: string
  pageJob: string | null
  pageType: string | null
  score: number | null
  verdict: string | null
  completedAt: Date | null
  createdAt: Date
  pipelineVersion: string | null
  reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
  evidenceCoverage?: unknown
  performanceData?: unknown
  screenshotCapture?: ScreenshotCaptureStatus
  parentId?: string | null
  pageSpeedErrors?: { desktopError?: string; mobileError?: string; pageSpeedPartial?: boolean }
  startedAt?: string | Date | null
  rubricRows: ReportRubricRow[]
  flags: RankableFlag[]
  screenshots: AuditScreenshot[]
  launchReadiness: ReturnType<typeof parseLaunchReadiness>
  rubrics: RubricComputed[]
  shareStatus: ShareStatus
}

export type SampleResult = {
  audit: LiveSampleAudit
  source: SampleSource
  pipelineVersion: string
  completedAt: Date | null
}

export type SampleEligibilityInput = {
  reportCompleteness?: string | null
  flags: { id: string }[]
  rubrics: { name: string }[]
  screenshots: { device: string; url: string }[]
}

function sampleUrlCandidates(raw: string): string[] {
  const domain = normalizeDomain(raw)
  if (!domain) {
    try {
      return [new URL(raw).toString()]
    } catch {
      return []
    }
  }
  return [
    `https://${domain}`,
    `https://${domain}/`,
    `https://www.${domain}`,
    `https://www.${domain}/`,
  ]
}

/** Eligibility for marketing display: completeness, screenshots, and rubric rows. Score is not a gate. */
export function isEligibleMarketingSample(audit: SampleEligibilityInput): boolean {
  if (audit.reportCompleteness !== 'FULL' && audit.reportCompleteness !== 'PARTIAL') {
    return false
  }
  if (audit.flags.length === 0) return false
  if (audit.rubrics.length === 0) return false
  return audit.screenshots.some(
    (s) => s.device === 'DESKTOP' && typeof s.url === 'string' && s.url.length > 0
  )
}

async function fixtureSample(): Promise<SampleResult> {
  const { getStaticSampleAudit } = await import('@/lib/marketing/static-sample')
  const audit = getStaticSampleAudit()
  return {
    audit,
    source: 'fixture',
    pipelineVersion: PIPELINE_VERSION,
    completedAt: audit.completedAt,
  }
}

function enrichDbAudit(audit: {
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    flags: Array<{ severity: string }>
  }>
  flags: Array<{ severity: string; rubric: string }>
  launchReadiness: unknown
  [key: string]: unknown
}): LiveSampleAudit {
  const rubricSources = audit.rubrics.map((r) => ({
    name: r.name,
    grade: r.grade,
    score: r.score,
    flags: r.flags.map((f) => ({ severity: f.severity })),
  }))
  const flatFlags = audit.flags.map((f) => ({
    severity: f.severity,
    rubric: f.rubric,
  }))
  const rubrics = computeRubricsFromRows(rubricSources, flatFlags)
  const shareStatus = computeShareStatusFromRubrics(rubricSources, flatFlags)
  const { rubricRows, flags } = buildReportShapeFromDb(audit.rubrics, audit.flags, shareStatus)
  return {
    ...(audit as unknown as LiveSampleAudit),
    launchReadiness: parseLaunchReadiness(audit.launchReadiness),
    rubrics,
    rubricRows,
    flags,
    shareStatus,
  }
}

export async function getLiveSampleAudit(): Promise<SampleResult> {
  try {
    const defaultSampleUrl = process.env.SAMPLE_AUDIT_URL ?? DEFAULT_SAMPLE_AUDIT_URL
    const sampleDomain = normalizeDomain(defaultSampleUrl)

    let audit = null
    let source: SampleSource = 'fixture'

    if (sampleDomain) {
      // Prefer a public curated audit for the configured sample URL.
      audit = await prisma.audit.findFirst({
        where: {
          status: 'COMPLETED',
          isPublic: true,
          reportCompleteness: { in: ['FULL', 'PARTIAL'] },
          OR: [
            { normalizedDomain: sampleDomain },
            { url: { in: sampleUrlCandidates(defaultSampleUrl) } },
          ],
        },
        orderBy: { completedAt: 'desc' },
        include: sampleInclude,
      })
      if (audit && isEligibleMarketingSample(audit)) {
        source = 'live'
      } else {
        audit = null
      }
    }

    if (!audit) {
      audit = await prisma.audit.findFirst({
        where: {
          status: 'COMPLETED',
          isPublic: true,
          reportCompleteness: { in: ['FULL', 'PARTIAL'] },
        },
        orderBy: { completedAt: 'desc' },
        include: sampleInclude,
      })
      if (audit && isEligibleMarketingSample(audit)) {
        source = 'curated'
      } else {
        audit = null
      }
    }

    if (!audit) {
      return fixtureSample()
    }

    return {
      audit: enrichDbAudit(audit),
      source,
      pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
      completedAt: audit.completedAt,
    }
  } catch {
    return fixtureSample()
  }
}
