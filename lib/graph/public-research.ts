import { z } from 'zod'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'

export const PUBLIC_RESEARCH_PATH = 'research/public-issues/v1'
export const PUBLIC_RESEARCH_KIND = 'approved-public-issue-research-v1'
export const MIN_PUBLIC_RESEARCH_SITES = 20

const text = z.string().trim().min(1).max(4_000).regex(/^[^<>]*$/, 'Plain text required')
const count = z.number().int().safe().nonnegative()
const timestamp = z.iso.datetime()

const issue = z.strictObject({
  checkId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  checkVersion: z.number().int().positive(),
  rubric: z.enum(['MESSAGE', 'EXPERIENCE', 'REACH']),
  problemTemplate: text,
  fixTemplate: text,
  siteCount: count.min(MIN_PUBLIC_RESEARCH_SITES),
  occurrenceCount: count,
  topFrameworks: z.array(z.strictObject({
    name: z.string().trim().min(1).max(80),
    siteCount: count.min(MIN_PUBLIC_RESEARCH_SITES),
  })).max(5),
})

/** Approval references are private operator evidence, never part of the page model. */
export const publicIssueResearchSchema = z.strictObject({
  version: z.literal(1),
  status: z.literal('approved'),
  evidenceRef: text,
  permittedUseRef: text,
  copyReviewRef: text,
  reviewedAt: timestamp,
  expiresAt: timestamp,
  windowStart: timestamp,
  windowEnd: timestamp,
  sampleSiteCount: count.min(MIN_PUBLIC_RESEARCH_SITES),
  methodology: text,
  limitations: z.array(text).min(1).max(20),
  issues: z.array(issue).max(500),
}).superRefine((dataset, ctx) => {
  const start = Date.parse(dataset.windowStart)
  const end = Date.parse(dataset.windowEnd)
  const reviewed = Date.parse(dataset.reviewedAt)
  if (start > end || end > reviewed || reviewed >= Date.parse(dataset.expiresAt)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid observation, review, or expiry window' })
  }
  const ids = new Set<string>()
  for (const row of dataset.issues) {
    const definition = CHECK_REGISTRY[row.checkId]
    if (!definition || definition.version !== row.checkVersion || ids.has(row.checkId)) {
      ctx.addIssue({ code: 'custom', message: 'Unknown, duplicate, or version-mismatched check' })
    }
    ids.add(row.checkId)
    if (row.siteCount > dataset.sampleSiteCount || row.occurrenceCount < row.siteCount) {
      ctx.addIssue({ code: 'custom', message: 'Inconsistent issue counts' })
    }
    const technologies = new Set<string>()
    for (const framework of row.topFrameworks) {
      if (framework.siteCount > row.siteCount || technologies.has(framework.name)) {
        ctx.addIssue({ code: 'custom', message: 'Inconsistent framework counts' })
      }
      technologies.add(framework.name)
    }
  }
})

export type PublicIssueResearch = z.infer<typeof publicIssueResearchSchema>

/** Invalid, unreviewed, future-reviewed, or expired releases fail closed. */
export function parsePublicIssueResearch(payload: unknown, now = new Date()): PublicIssueResearch | null {
  const parsed = publicIssueResearchSchema.safeParse(payload)
  if (!parsed.success || Date.parse(parsed.data.reviewedAt) > now.getTime() ||
    Date.parse(parsed.data.expiresAt) <= now.getTime()) return null
  return parsed.data
}
