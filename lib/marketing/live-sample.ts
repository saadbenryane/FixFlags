import { prisma } from '@/lib/db'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { HERO_FIX_PROMPT } from '@/lib/marketing/copy'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'

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
  areas: Array<{
    id: string
    name: string
    grade: string | null
    score: number | null
    status: string | null
    summary: string
    areaPrompt: string
    findings: Array<{
      id: string
      problem: string
      evidence: string
      whyItMatters: string
      fix: string
      severity: string
      agentPrompt: string | null
      cursorPrompt: string | null
    }>
  }>
  screenshots: AuditScreenshot[]
  launchReadiness: ReturnType<typeof parseLaunchReadiness>
  [key: string]: unknown
}

export type SampleResult = {
  audit: LiveSampleAudit | null
  source: SampleSource
  pipelineVersion: string
  completedAt: Date | null
  staticFixPrompt?: typeof HERO_FIX_PROMPT
}

export async function getLiveSampleAudit(): Promise<SampleResult> {
  const configuredUrl = process.env.SAMPLE_AUDIT_URL
  let audit = null
  let source: SampleSource = 'static'

  if (configuredUrl) {
    const normalized = new URL(configuredUrl).toString()
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
    return {
      audit: null,
      source: 'static',
      pipelineVersion: PIPELINE_VERSION,
      completedAt: null,
      staticFixPrompt: HERO_FIX_PROMPT,
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
