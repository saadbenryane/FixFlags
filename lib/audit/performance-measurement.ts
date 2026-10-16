import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import type { PageSpeedResult } from './pagespeed'
import type { DeterministicFlag } from './flag-types'
import type { CheckAssertion } from './checks/assertion'

const key = z.string().regex(/^[a-f0-9]{64}$/)
const measurementScopeSchema = z.object({ requestedKey: key, finalKey: key, profileKey: key }).strict()

export const performanceMeasurementSchema = z.object({
  version: z.literal(1), source: z.literal('google-pagespeed'), strategy: z.enum(['desktop', 'mobile']),
  receivedAt: z.string().datetime(), measuredAt: z.string().datetime().nullable(),
  lighthouseVersion: z.string().max(100).nullable(), formFactor: z.string().max(40).nullable(),
  throttlingMethod: z.string().max(40).nullable(),
  scope: measurementScopeSchema.nullable().optional(),
}).strict()
export type PerformanceMeasurement = z.infer<typeof performanceMeasurementSchema>

const settingsSchema = z.object({
  formFactor: z.string().max(40).optional(), emulatedFormFactor: z.string().max(40).optional(),
  throttlingMethod: z.string().max(40).optional(), locale: z.string().max(100).optional(),
  throttling: z.object({ rttMs: z.number().finite().nonnegative().optional(), throughputKbps: z.number().finite().nonnegative().optional(),
    requestLatencyMs: z.number().finite().nonnegative().optional(), downloadThroughputKbps: z.number().finite().nonnegative().optional(),
    uploadThroughputKbps: z.number().finite().nonnegative().optional(), cpuSlowdownMultiplier: z.number().finite().positive().optional() }).optional(),
  screenEmulation: z.object({ mobile: z.boolean().optional(), width: z.number().finite().positive().optional(), height: z.number().finite().positive().optional(),
    deviceScaleFactor: z.number().finite().positive().optional(), disabled: z.boolean().optional() }).optional(),
  emulatedUserAgent: z.union([z.string().max(2000), z.literal(false)]).optional(),
})
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function pageKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? hash(normalizeVerifierUrl(url.href)) : null
  } catch { return null }
}

/** Whitelist provider conditions before its raw response is discarded. */
export function performanceMeasurement(raw: Record<string, unknown>, strategy: 'desktop' | 'mobile'): PerformanceMeasurement {
  const settings = settingsSchema.safeParse(raw.configSettings)
  const measuredAt = z.string().datetime().safeParse(raw.fetchTime)
  const engine = z.string().max(100).safeParse(raw.lighthouseVersion)
  const formFactor = settings.success ? settings.data.formFactor ?? settings.data.emulatedFormFactor ?? null : null
  const requestedKey = pageKey(raw.requestedUrl), finalKey = pageKey(raw.finalDisplayedUrl ?? raw.finalUrl)
  const userAgent = z.string().max(2000).safeParse(raw.userAgent)
  const scope = settings.success && engine.success && engine.data.length && formFactor === strategy && requestedKey && finalKey
    ? { requestedKey, finalKey, profileKey: hash({ engine: engine.data, formFactor,
      throttlingMethod: settings.data.throttlingMethod ?? 'provider-default', throttling: settings.data.throttling ?? null,
      screenEmulation: settings.data.screenEmulation ?? null, emulatedUserAgent: settings.data.emulatedUserAgent ?? null,
      userAgent: userAgent.success ? userAgent.data : null, locale: settings.data.locale ?? null }) } : null
  return { version: 1, source: 'google-pagespeed', strategy, receivedAt: new Date().toISOString(),
    measuredAt: measuredAt.success ? measuredAt.data : null, lighthouseVersion: engine.success ? engine.data : null,
    formFactor, throttlingMethod: settings.success ? settings.data.throttlingMethod ?? null : null, scope }
}

export const PAGESPEED_LAB_RULE = 'PageSpeed lab observation v1: repeat the original page, redirect, engine and measurement profile.'
export function performanceLabKey(checkId: string): 'score' | 'lcp' | 'cls' | undefined {
  if (['perf-score-critical', 'perf-score-poor', 'mobile-perf-critical', 'mobile-perf-poor'].includes(checkId)) return 'score'
  if (['lcp-critical', 'lcp-poor', 'mobile-lcp-critical', 'mobile-lcp-poor'].includes(checkId)) return 'lcp'
  if (['cls-critical', 'cls-poor', 'mobile-cls-critical', 'mobile-cls-poor'].includes(checkId)) return 'cls'
}

export function readPerformanceContext(value: string | undefined) {
  const match = value && /^pagespeed-condition:v1:([a-f0-9]{64}):([a-f0-9]{64}):(.+)$/.exec(value)
  return match ? { pageKey: match[1], measurementKey: match[2], context: match[3] } : null
}
export function performancePageKey(url: string) { return pageKey(url) }

export function performanceConditionContext(data: PageSpeedResult, url: string, context: string) {
  if (context.startsWith('pagespeed-condition:v1:')) return context
  const measurement = performanceMeasurementSchema.safeParse(data.diagnostics.measurement)
  const requestedKey = pageKey(url)
  const scope = measurement.success && measurement.data.strategy === data.strategy &&
    measurement.data.scope?.requestedKey === requestedKey ? measurement.data.scope : null
  return `pagespeed-condition:v1:${requestedKey ?? 'unknown'}:${scope ? hash([data.strategy, scope]) : 'unknown'}:${context}`
}

/** Counts remain observable when old provider conditions are missing, but an
 * unscoped measurement can never certify recovery under new conditions. */
export function scopePerformanceFlags(data: PageSpeedResult, url: string | undefined, flags: DeterministicFlag[]) {
  return flags.map(flag => {
    const lab = performanceLabKey(flag.checkId)
    if (!lab && !flag.evidenceTargets?.length) return flag
    return { ...flag, ...(lab ? { verificationRule: PAGESPEED_LAB_RULE } : {}),
      evidenceTargets: (flag.evidenceTargets?.length ? flag.evidenceTargets : [{ kind: 'page' as const, source: 'measured' as const,
        device: data.strategy, label: 'PageSpeed lab measurement', context: 'lab:' + lab }]).map(target => ({ ...target,
        context: performanceConditionContext(data, url ?? '', target.context ?? 'unknown') })) }
  })
}

export function scopePerformanceAssertions(data: PageSpeedResult, url: string, assertions: CheckAssertion[]) {
  return assertions.map(assertion => assertion.key === 'inp' ? assertion : { ...assertion,
    ...(['score', 'lcp', 'cls'].includes(assertion.key) || assertion.context ? { context: performanceConditionContext(data, url, assertion.context ?? 'lab:' + assertion.key) } : {}),
    ...(assertion.measurements ? { measurements: assertion.measurements.map(measurement => ({ ...measurement,
      context: performanceConditionContext(data, url, measurement.context) })) } : {}),
    ...(assertion.targets ? { targets: assertion.targets.map(target => ({ ...target,
      context: performanceConditionContext(data, url, target.context ?? 'unknown') })) } : {}) })
}
