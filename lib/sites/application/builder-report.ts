import { z } from 'zod'
import { prisma } from '@/lib/db'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'

/** Answers to "Where did you build this site?". The first answer for a Site is kept. */
export const REPORTED_BUILDERS = ['lovable', 'bolt', 'v0', 'replit', 'cursor', 'claude-code', 'windsurf', 'codex', 'other-ai', 'no-ai'] as const
export type ReportedBuilder = (typeof REPORTED_BUILDERS)[number]

export const builderReportSchema = z.object({ tool: z.enum(REPORTED_BUILDERS) }).strict()

const key = (projectId: string) => `builder-reported:${projectId}`

export async function loadReportedBuilder(projectId: string): Promise<ReportedBuilder | null> {
  const event = await prisma.siteLifecycleEvent.findUnique({ where: { idempotencyKey: key(projectId) }, select: { properties: true } })
  const tool = event?.properties && typeof event.properties === 'object' ? (event.properties as Record<string, unknown>).tool : null
  return REPORTED_BUILDERS.includes(tool as ReportedBuilder) ? tool as ReportedBuilder : null
}

export async function reportBuilder(input: { projectId: string; userId: string; tool: ReportedBuilder }): Promise<ReportedBuilder> {
  await recordSiteLifecycleEvent({ name: 'builder_reported', idempotencyKey: key(input.projectId), userId: input.userId, projectId: input.projectId, properties: { tool: input.tool } })
  return (await loadReportedBuilder(input.projectId)) ?? input.tool
}
