import { z } from 'zod'
import type { SiteHomeView } from './application/queries'
import { siteCheckResultSchema } from './check-results'
import { watchIntervalSchema } from './watch-schedule'

const text = z.string(), nullableText = text.nullable(), count = z.number().int().nonnegative()
const time = z.string().datetime({ offset: true }), nullableTime = time.nullable()
const date = z.union([z.date(), time]).transform(value => new Date(value)).nullable()
const area = z.enum(['site', 'security', 'search', 'performance', 'conversion', 'tracking', 'uptime', 'accessibility'])
const health = z.enum(['healthy', 'attention', 'problem', 'unknown', 'checking'])
const connection = z.object({ provider: z.enum(['SEARCH_CONSOLE', 'ANALYTICS']), configured: z.boolean(),
  status: z.enum(['not_connected', 'connected', 'mismatch', 'needs_reauth', 'revoked']),
  propertyLabel: nullableText, detail: nullableText, lastSyncedAt: nullableTime })
const flag = z.object({
  attentionPolicy: z.unknown().optional(), id: text, sourceFlagId: nullableText.optional(), confidence: z.number().nullable().optional(),
  improvementId: nullableText, checkId: nullableText, rubric: text, severity: text, impactTag: nullableText,
  problem: text, evidence: text, whyItMatters: text, fix: text, pageUrl: nullableText, status: text,
  resolvedInId: nullableText, area, affectedPaths: z.array(text), affectedPageCount: count,
  priorityBand: z.enum(['fix_first', 'other']), priorityScore: z.number(), relatedOutcome: z.object({ id: text, name: text }).nullable(),
  verificationState: z.enum(['unverified', 'verifying', 'verified', 'still_open', 'could_not_verify', 'regressed']), latestOccurrenceAt: nullableTime,
})

/** Full client projection contract. A malformed refresh cannot replace recorded evidence. */
export const siteHomeViewSchema: z.ZodType<SiteHomeView> = z.object({
  site: z.object({ siteId: text, kind: z.enum(['project', 'provisional']), url: text, canonicalHost: text, name: text,
    projectId: nullableText, provisionalSiteId: nullableText, primaryAuditId: nullableText,
    watchInterval: watchIntervalSchema.nullable(), watchEveryMinutes: count.nullable().optional(),
    watchNextRunAt: date, watchLastRunAt: date, watchLastError: nullableText, watchConsecutiveFailures: count, userId: nullableText }),
  presentation: z.object({
    identity: z.object({ siteId: text, name: text, host: text,
      preview: z.object({ url: text, pageUrl: text, viewport: text, recordedAt: nullableTime }).nullable() }),
    result: z.object({ state: z.enum(['checking', 'flags', 'clear', 'could_not_verify', 'stale', 'failed']), label: text }),
    monitoring: z.object({ state: z.enum(['not_monitored', 'weekly', 'daily', 'hourly', 'custom', 'paused', 'delayed', 'quota_blocked']), label: text }),
    coverage: z.object({ pagesReached: count, pagesExpected: count, label: text, complete: z.boolean() }),
    freshness: z.object({ checkedAt: nullableTime, stale: z.boolean(), label: text }),
    flags: z.object({ count, label: text, fixFirstCount: count }),
    run: z.object({ state: z.enum(['idle', 'queued', 'running', 'partial', 'failed', 'interrupted']), label: text,
      auditId: nullableText, recoveryAction: z.enum(['retry', 'view_details']).nullable() }),
    categories: z.array(z.object({ id: area, name: text, state: health, answer: text, status: text, flagCount: count,
      fixFirstCount: count, checkedAt: nullableTime, freshness: text, coverageLimitation: nullableText, rank: z.number(), href: text })),
  }),
  activity: z.object({ state: z.enum(['queued', 'running', 'completed', 'partial', 'failed', 'unverified']), label: text,
    pagesReached: count, milestones: z.array(z.object({ label: text, state: z.enum(['done', 'current', 'pending', 'partial']) })),
    events: z.array(z.object({ label: text, at: time })) }).optional(),
  recoveryUnavailable: z.boolean().optional(),
  executionProgress: z.object({ total: count, completed: count, running: count, pending: count, recovering: count,
    unknown: count, inapplicable: count, recoveryUntil: nullableTime, eventCursor: nullableText,
    tasks: z.array(z.object({ id: text, kind: text, module: nullableText.optional(), device: z.enum(['desktop', 'mobile']).nullable().optional(),
      pageUrl: text, state: text, attempts: count, reason: nullableText, retryAt: nullableTime })).max(100),
  }).nullable().optional(),
  audit: z.object({ id: nullableText, status: nullableText, progress: z.number().min(0).max(100), walkFinished: z.boolean(), failureCode: nullableText }),
  cards: z.array(z.object({ id: area, name: text, question: text, state: health, status: text, answer: text, detail: nullableText,
    facts: z.array(text), coverage: nullableText, evidenced: z.boolean(), openFlagCount: count, checkedAt: nullableTime,
    flagIds: z.array(text), flagChips: z.array(z.object({ id: text, title: text, href: text })), sources: z.array(text),
    activity: z.literal('checking').nullable(), wide: z.boolean(), captureUrl: nullableText, captureAlt: nullableText,
    cropUrl: nullableText, cropAlt: nullableText, problem: z.object({ title: text, body: nullableText, outcomeName: nullableText, href: text, actionLabel: text }).nullable(),
    incompleteReason: nullableText.optional(),
  })).max(32),
  flags: z.array(flag), recommendations: z.array(flag), resolvedFlags: z.array(flag),
  outcomes: z.array(z.object({ id: text, name: text, slug: text, description: nullableText,
    inferenceSource: z.enum(['heuristic', 'browser', 'user']), confirmedAt: nullableTime, pageIds: z.array(text), pageUrls: z.array(text),
    kind: z.enum(['GENERIC', 'CHECKOUT', 'SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'AVAILABILITY']), criticality: z.enum(['CRITICAL', 'IMPORTANT', 'INFORMATIONAL']),
    environment: text, enabled: z.boolean(), staleAfterMinutes: count, expectation: nullableText,
    bindings: z.array(z.object({ key: text, required: z.boolean(), scope: z.json(), mechanism: text, version: count })), coverage: z.json(),
    state: z.enum(['CLEAR', 'FLAG', 'COULD_NOT_VERIFY', 'STALE']), summary: text, lastVerifiedAt: nullableTime,
    validUntil: nullableTime, flagId: nullableText, latestRunId: nullableText, running: z.boolean(),
  })),
  checkResults: z.array(siteCheckResultSchema).max(100).optional(), checkResultsNextCursor: nullableText.optional(),
  technology: z.object({ status: z.enum(['complete', 'partial', 'unavailable', 'not_captured']), detectedAt: nullableTime,
    items: z.array(z.object({ slug: text, name: text, category: z.enum(['framework', 'builder', 'hosting', 'analytics', 'monitoring', 'cms', 'commerce', 'payments', 'support', 'security', 'form']), confidenceBand: z.enum(['verified', 'supported']) })) }).optional(),
  monitoringHistory: z.array(z.object({ id: text.optional(), checkedAt: time, flagCount: count,
    status: z.enum(['COMPLETED', 'FAILED']).optional(), flags: z.array(z.object({ id: text, title: text })).optional(),
    scope: z.enum(['SITE', 'OUTCOMES', 'DIAGNOSTIC', 'UNKNOWN']).optional(), targetLabel: nullableText.optional(),
    trigger: z.enum(['MANUAL', 'SCHEDULED', 'OTHER', 'UNKNOWN']).optional(), afterFix: z.boolean().optional(),
    result: z.enum(['CLEAR', 'FLAG', 'COULD_NOT_VERIFY']).nullable().optional() })).optional(),
  watch: z.object({ state: z.enum(['off', 'watching', 'paused', 'delayed', 'quota']), interval: watchIntervalSchema.nullable(),
    everyMinutes: count.nullable().optional(), nextRunAt: nullableTime, lastRunAt: nullableTime, lastError: nullableText,
    covered: z.boolean(), label: text, alert: z.object({ state: z.enum(['none', 'delivering', 'delivered', 'undelivered']),
      status: z.enum(['NOT_APPLICABLE', 'PENDING', 'SENDING', 'SENT', 'FAILED']).nullable(), attempts: count, leaseUntil: nullableTime.optional(), at: nullableTime }),
  }),
  checkedPages: z.array(z.object({ url: text, title: nullableText, status: text, checkedAt: time })).optional(),
  settings: z.object({ notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY', 'OFF']).nullable(), notifyOnRecovery: z.boolean().nullable(),
    shopify: z.object({ configured: z.boolean(), state: z.enum(['connected', 'unavailable', 'not_connected']), domain: nullableText }),
    searchConsole: connection, analytics: connection }),
})

export function readSiteHomeView(payload: unknown, expectedSiteId: string): SiteHomeView {
  const view = siteHomeViewSchema.parse(payload)
  if (view.site.siteId !== expectedSiteId || view.presentation.identity.siteId !== expectedSiteId)
    throw new Error('Site projection identity mismatch')
  return view
}
