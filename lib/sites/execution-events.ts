import { z } from 'zod'

/** Transport notices identify committed projections, never their private data. */
export const projectionNoticeSchema = z.object({ version: z.literal(1), kind: z.string(), state: z.string(),
  taskId: z.string().nullable(), observationReference: z.string().nullable() }).strict()
export const siteProjectionNoticeSchema = projectionNoticeSchema.extend({ auditId: z.string().min(1).max(200) })
export type SiteProjectionNotice = z.infer<typeof siteProjectionNoticeSchema>

export function readSiteProjectionNotice(value: unknown): SiteProjectionNotice | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = siteProjectionNoticeSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch { return null }
}
