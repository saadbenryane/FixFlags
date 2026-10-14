import { uptimeSummarySchema, uptimeIncidentSchema } from '@/lib/uptime/contracts'
import { accountViewSchema } from './accounts/contracts'
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
  status: z.enum(['not_connected', 'connected', 'mismatch', 'needs_reauth', 'revoked', 'unavailable']),
  propertyLabel: nullableText, detail: nullableText, lastSyncedAt: nullableTime })
const flag = z.object({
  attentionPolicy: z.unknown().optional(), id: text, sourceFlagId: nullableText.optional(), confidence: z.number().nullable().optional(),
  improvementId: nullableText, checkId: nullableText, rubric: text, severity: text, impactTag: nullableText,
  problem: text, evidence: text, whyItMatters: text, fix: text, pageUrl: nullableText, status: text,
  resolvedInId: nullableText, area, affectedPaths: z.array(text), affectedPageCount: count,
  priorityBand: z.enum(['fix_first', 'other']), priorityScore: z.number(), relatedOutcome: z.object({ id: text, name: text }).nullable(),
  verificationState: z.enum(['unverified', 'verifying', 'verified', 'still_open', 'could_not_verify', 'regressed']), latestOccurrenceAt: nullableTime,
})

const recovery = z.object({ action: z.enum(['retry', 'access', 'connections', 'inspect', 'support']), reasons: z.array(text).max(1200) })

const historyEntry = z.object({ id: text, checkedAt: time, evidenceAt: nullableTime, completionState: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']), flagCount: count,
    status: z.enum(['COMPLETED', 'FAILED']), flags: z.array(z.object({ id: text, title: text })),

    scope: z.enum(['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC', 'UNKNOWN']), targetLabel: nullableText,
    trigger: z.enum(['MANUAL', 'SCHEDULED', 'OTHER', 'UNKNOWN']), afterFix: z.boolean(),
    result: z.enum(['CLEAR', 'FLAG', 'COULD_NOT_VERIFY']).nullable() })


/** Full client projection contract. A malformed refresh cannot replace recorded evidence. */
export const siteHomeViewSchema: z.ZodType<SiteHomeView> = z.object({
  schemaVersion: z.literal(2),
  actions: z.object({ ownership: z.enum(['owner', 'provisional']),
    check: z.enum(['available', 'sign_in', 'claim']), copy: z.enum(['available', 'sign_in', 'claim']),
    monitoring: z.enum(['available', 'sign_in', 'claim']), integrations: z.enum(['available', 'sign_in', 'claim']),
    history: z.enum(['available', 'sign_in', 'claim']) }).superRefine((actions, context) => {
      const values = [actions.check, actions.copy, actions.monitoring, actions.integrations, actions.history]
      if (actions.ownership === 'owner' ? values.some(value => value !== 'available') : values.some(value => value === 'available') || new Set(values).size !== 1)
        context.addIssue({ code: 'custom', message: 'Inconsistent Site action authority' })
    }),
  counts: z.object({ flags: count, checkedPages: count, recordedPages: count, savedPages: count, categories: z.record(area, count), pages: z.record(text, count) }),
  captures: z.array(z.object({ auditId: text, device: z.enum(['desktop', 'mobile']), previous: z.boolean(),
    url: text, pageUrl: text, viewport: text, recordedAt: nullableTime })).max(2).optional(),
  uptime: uptimeSummarySchema.nullable().optional(),
  uptimeEvents: z.array(uptimeIncidentSchema).max(50).optional(),
  inventoryPageCount: count,
  activeRuns: z.array(z.object({ id: text, auditId: nullableText, scope: z.enum(['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC', 'UNKNOWN']),
    targetLabel: nullableText, trigger: z.enum(['MANUAL', 'SCHEDULED', 'OTHER', 'UNKNOWN']), status: z.enum(['QUEUED', 'RUNNING', 'INTERRUPTED']),
    requestedAt: time, progress: z.number().min(0).max(100) })),
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
    recovery: recovery.nullable().optional(), categoryRecovery: z.record(area, recovery).optional(),
    summary: z.object({ total: count, recorded: count, limited: count, failed: count, notApplicable: count,
      pending: count, recovering: count, state: z.enum(['active', 'finished', 'limited', 'failed']), reasons: z.array(text).max(1200) }).optional(),
    tasks: z.array(z.object({ id: text, kind: text, module: nullableText.optional(), device: z.enum(['desktop', 'mobile']).nullable().optional(),
      pageUrl: text, state: text, attempts: count, reason: nullableText, retryAt: nullableTime })).max(100),
  }).nullable().optional(),
  audit: z.object({ id: nullableText, status: nullableText, progress: z.number().min(0).max(100), walkFinished: z.boolean(), failureCode: nullableText }),
  cards: z.array(z.object({ id: area, name: text, question: text, state: health, status: text, answer: text, detail: nullableText,
    facts: z.array(text), coverage: nullableText, evidenced: z.boolean(), openFlagCount: count, checkedAt: nullableTime,
    flagIds: z.array(text), flagChips: z.array(z.object({ id: text, sourceFlagId: nullableText.optional(), title: text, href: text })), sources: z.array(text),
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
  monitoringHistory: z.array(historyEntry),
  monitoringTrend: z.array(historyEntry),
  watch: z.object({ state: z.enum(['off', 'watching', 'paused', 'delayed', 'quota']), interval: watchIntervalSchema.nullable(),
    everyMinutes: count.nullable().optional(), nextRunAt: nullableTime, lastRunAt: nullableTime, lastError: nullableText,
    covered: z.boolean(), label: text, alert: z.object({ state: z.enum(['none', 'delivering', 'accepted', 'delivered', 'undelivered'])
      .transform(state => state === 'delivered' ? 'accepted' as const : state),
      status: z.enum(['NOT_APPLICABLE', 'PENDING', 'SENDING', 'SENT', 'FAILED']).nullable(), attempts: count, leaseUntil: nullableTime.optional(), at: nullableTime }),
  }),
  checkedPages: z.array(z.object({ url: text, title: nullableText, status: text, checkedAt: time,
    capture: z.object({ url: text.startsWith('/api/screenshots/'), viewport: text, recordedAt: nullableTime }).nullable().optional(),
  })).optional(),
  settings: z.object({ accountChecks: accountViewSchema.optional(), notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY', 'OFF']).nullable(), notifyOnRecovery: z.boolean().nullable(),
    shopify: z.object({ configured: z.boolean(), state: z.enum(['connected', 'unavailable', 'not_connected']), domain: nullableText }),
    searchConsole: connection, analytics: connection }),
})

export function readSiteHomeView(payload: unknown, expectedSiteId: string): SiteHomeView {
  const view = siteHomeViewSchema.parse(payload)
  if (view.site.siteId !== expectedSiteId || view.presentation.identity.siteId !== expectedSiteId)
    throw new Error('Site projection identity mismatch')
  return view
}
