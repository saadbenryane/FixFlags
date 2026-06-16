import { prisma } from '@/lib/db'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
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

export type SampleSource = 'live' | 'archived' | 'static'

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

export async function getLiveSampleAudit(): Promise<SampleResult> {
  const defaultSampleUrl =
    process.env.SAMPLE_AUDIT_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://fixflags.com'
  let audit = null
  let source: SampleSource = 'static'

  try {
    const normalized = new URL(defaultSampleUrl).toString()
    audit = await prisma.audit.findFirst({
      where: {
        url: normalized,
        status: 'COMPLETED',
        isPublic: true,
        reportCompleteness: { in: ['FULL', 'PARTIAL'] },
      },
      orderBy: { completedAt: 'desc' },
      include: sampleInclude,
    })
    if (audit) source = 'live'
  } catch {
    // Invalid SAMPLE_AUDIT_URL; fall through to archived/static sample.
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
    if (audit) source = 'archived'
  }

  if (!audit) {
    const { getStaticSampleAudit } = await import('@/lib/marketing/static-sample')
    return {
      audit: getStaticSampleAudit(),
      source: 'static',
      pipelineVersion: PIPELINE_VERSION,
      completedAt: new Date(),
    }
  }

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
  const enriched: LiveSampleAudit = {
    ...audit,
    launchReadiness: parseLaunchReadiness(audit.launchReadiness),
    rubrics,
    rubricRows,
    flags,
    shareStatus,
  }

  return {
    audit: enriched,
    source,
    pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
    completedAt: audit.completedAt,
  }
}
