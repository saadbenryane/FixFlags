import { z } from 'zod'
import { SITE_CARD_AREAS } from './card-areas'
import type { SitePresentation } from './presentation'

export const siteCardAreaSchema = z.enum(SITE_CARD_AREAS)
export const cardHealthSchema = z.enum(['healthy', 'attention', 'problem', 'unknown', 'checking'])
const text = z.string(), count = z.number().int().nonnegative()
const nullableText = text.nullable(), nullableTime = z.string().datetime({ offset: true }).nullable()

/** Overview and full Site reads must agree on the same customer-facing facts. */
export const sitePresentationSchema: z.ZodType<SitePresentation> = z.object({
  identity: z.object({ siteId: text, name: text, host: text,
    preview: z.object({ url: text, pageUrl: text, viewport: text, recordedAt: nullableTime }).nullable() }),
  result: z.object({ state: z.enum(['checking', 'flags', 'clear', 'could_not_verify', 'stale', 'failed']), label: text }),
  monitoring: z.object({ state: z.enum(['not_monitored', 'weekly', 'daily', 'hourly', 'custom', 'paused', 'delayed', 'quota_blocked']), label: text }),
  coverage: z.object({ pagesReached: count, pagesExpected: count, label: text, complete: z.boolean() }),
  freshness: z.object({ checkedAt: nullableTime, stale: z.boolean(), label: text }),
  flags: z.object({ count, label: text, fixFirstCount: count }),
  run: z.object({ state: z.enum(['idle', 'queued', 'running', 'partial', 'failed', 'interrupted']), label: text,
    auditId: nullableText, recoveryAction: z.enum(['retry', 'view_details']).nullable() }),
  categories: z.array(z.object({ id: siteCardAreaSchema, name: text, state: cardHealthSchema, answer: text, status: text, flagCount: count,
    fixFirstCount: count, checkedAt: nullableTime, freshness: text, coverageLimitation: nullableText, rank: z.number(), href: text })),
})
