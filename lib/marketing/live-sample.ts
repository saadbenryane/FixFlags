import { prisma } from '@/lib/db'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'

const sampleInclude = {
  areas: {
    orderBy: { name: 'asc' } as const,
    include: { findings: { orderBy: { position: 'asc' } as const } },
  },
  screenshots: {
    where: { page: { position: 0 } },
    orderBy: { device: 'asc' } as const,
  },
}

export type SampleSource = 'live' | 'archived' | 'static'

export type LiveSampleAreaFinding = {
  id: string
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  severity: string
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  verificationRule?: string | null
  pageUrl?: string | null
}

export type LiveSampleArea = {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  areaPrompt: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  findings: LiveSampleAreaFinding[]
}

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
  areas: LiveSampleArea[]
  screenshots: AuditScreenshot[]
  launchReadiness: ReturnType<typeof parseLaunchReadiness>
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
    'https://qualityos.com'
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
      audit: getStaticSampleAudit() as unknown as LiveSampleAudit,
      source: 'static',
      pipelineVersion: PIPELINE_VERSION,
      completedAt: new Date(),
    }
  }

  const enriched: LiveSampleAudit = {
    ...audit,
    launchReadiness: parseLaunchReadiness(audit.launchReadiness),
  }

  return {
    audit: enriched,
    source,
    pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
    completedAt: audit.completedAt,
  }
}
