import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import type { PageSpeedResult } from './pagespeed'
import type { DeterministicFlag } from './flag-types'
import type { CheckAssertion } from './checks/assertion'
import { performanceMeasurementSchema, type PerformanceMeasurement } from './performance-measurement-contract'
import { lighthouseRecord } from './lighthouse-audit'
import { baseCheckId } from './check-identity'
import { readSupportingObservations } from './flag-observations'

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
function publicPageUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 8192) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null
  } catch { return null }
}

function pageKey(value: unknown): string | null {
  const url = publicPageUrl(value)
  return url ? hash(normalizeVerifierUrl(url.href)) : null
}

/** With only provider URLs to qualify the landing, require an explicit
 * sign-in endpoint. An auth or login section can also contain public pages. */
export function pageSpeedReachedSignIn(raw: Record<string, unknown>, requestedUrl: string): boolean {
  const signIn = (value: unknown) => /\/(?:login|log-in|signin|sign-in|sign_in)\/?$/i.test(publicPageUrl(value)?.pathname ?? '')
  return !signIn(requestedUrl) && [raw.mainDocumentUrl, raw.finalUrl, raw.finalDisplayedUrl].some(signIn)
}

function reportsAnotherDevice(settings: unknown, strategy: PerformanceMeasurement['strategy']) {
  const config = lighthouseRecord(settings)
  return [config?.formFactor, config?.emulatedFormFactor].some(value =>
    (value === 'desktop' || value === 'mobile') && value !== strategy)
}

/** Scope contradictions must survive malformed optional profile settings. */
export function pageSpeedScopeMatches(raw: Record<string, unknown>, url: string, strategy: PerformanceMeasurement['strategy']) {
  const requested = pageKey(url)
  return requested !== null && (raw.requestedUrl === undefined || pageKey(raw.requestedUrl) === requested) &&
    !reportsAnotherDevice(raw.configSettings, strategy)
}

/** Whitelist provider conditions before its raw response is discarded. */
export function performanceMeasurement(raw: Record<string, unknown>, strategy: 'desktop' | 'mobile', requestedAt?: Date): PerformanceMeasurement {
  const settings = settingsSchema.safeParse(raw.configSettings)
  const measuredAt = z.string().datetime().safeParse(raw.fetchTime)
  const engine = z.string().max(100).safeParse(raw.lighthouseVersion)
  const formFactor = settings.success ? settings.data.formFactor ?? settings.data.emulatedFormFactor ?? null : null
  const mainDocumentUrl = raw.mainDocumentUrl ?? raw.finalUrl
  const requestedKey = pageKey(raw.requestedUrl)
  const finalKey = pageKey(raw.finalDisplayedUrl ?? mainDocumentUrl)
  const mainDocumentKey = pageKey(mainDocumentUrl ?? raw.finalDisplayedUrl)
  const userAgent = z.string().max(2000).safeParse(raw.userAgent)
  const scope = settings.success && engine.success && engine.data.length && formFactor === strategy && requestedKey && finalKey && mainDocumentKey &&
    !reportsAnotherDevice(raw.configSettings, strategy)
    ? { requestedKey, finalKey, profileKey: hash({ engine: engine.data, formFactor,
      throttlingMethod: settings.data.throttlingMethod ?? 'provider-default', throttling: settings.data.throttling ?? null,
      screenEmulation: settings.data.screenEmulation ?? null, emulatedUserAgent: settings.data.emulatedUserAgent ?? null,
      userAgent: userAgent.success ? userAgent.data : null, locale: settings.data.locale ?? null }),
      // Keep single-destination identities stable. A changed network document
      // and identical address bar need their own comparison scope.
      ...(mainDocumentKey === finalKey ? {} : { mainDocumentKey }) } : null
  return { version: 1, source: 'google-pagespeed', strategy, receivedAt: new Date().toISOString(),
    ...(requestedAt ? { requestedAt: requestedAt.toISOString() } : {}),
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

export function performanceLabFamily(checkId: string | null | undefined) {
  const id = baseCheckId(checkId)
  if (!id) return undefined
  const metric = performanceLabKey(id)
  return metric ? { metric, module: id.startsWith('mobile-') ? 'mobile' as const : 'performance' as const } : undefined
}

/** All original measurements must be identifiable before one severity band
 * can stand in for another. Legacy or incomplete evidence stays separate. */
export function recordedPerformanceLabScope(flag: { checkId: string | null; verificationRule?: string | null;
  evidenceTargets?: unknown; supportingObservations?: unknown }) {
  const family = performanceLabFamily(flag.checkId)
  if (!family || flag.verificationRule !== PAGESPEED_LAB_RULE) return undefined
  const observations = readSupportingObservations(flag.supportingObservations)
  if (flag.supportingObservations != null && !observations) return undefined
  const conditions = new Set<string>()
  for (const item of observations?.items ?? [flag]) {
    const source = performanceLabFamily(item.checkId)
    if (source?.metric !== family.metric || source.module !== family.module || item.verificationRule !== PAGESPEED_LAB_RULE ||
      !Array.isArray(item.evidenceTargets) || !item.evidenceTargets.length) return undefined
    for (const target of item.evidenceTargets) {
      if (typeof target?.context !== 'string' || readPerformanceContext(target.context)?.context !== 'lab:' + family.metric) return undefined
      conditions.add(target.context)
    }
  }
  return { ...family, conditions }
}

/** Receiving a provider response does not establish a new measurement. Missing
 * timing and inconsistent clocks remain observable, without certifying repair. */
function measuredDuringRequest(measurement: PerformanceMeasurement) {
  const requested = Date.parse(measurement.requestedAt ?? ''), measured = Date.parse(measurement.measuredAt ?? '')
  return Number.isFinite(requested) && Number.isFinite(measured) && requested <= measured && measured <= Date.parse(measurement.receivedAt)
}

type LabObservation = Pick<PageSpeedResult, 'strategy' | 'diagnostics'>

function currentLabMeasurement(data: LabObservation, requestedKey: string | null) {
  const measurement = performanceMeasurementSchema.safeParse(data.diagnostics.measurement)
  return requestedKey && measurement.success && measuredDuringRequest(measurement.data) && measurement.data.strategy === data.strategy &&
    (!measurement.data.scope || measurement.data.scope.requestedKey === requestedKey) ? measurement.data : null
}

export function hasCurrentPageSpeedLabMeasurement(data: LabObservation, url: string) {
  return currentLabMeasurement(data, pageKey(url)) !== null
}

function labConditionPrefix(requestedKey: string | null, measurement: PerformanceMeasurement | null) {
  const scope = measurement?.scope
  const measurementKey = measurement && scope ? hash([measurement.strategy, scope]) : 'unknown'
  return `pagespeed-condition:v1:${requestedKey ?? 'unknown'}:${measurementKey}:`
}

function qualifyCondition(prefix: string, context: string) {
  return prefix + (/^pagespeed-condition:v1:[^:]+:[^:]+:(.+)$/.exec(context)?.[1] ?? context)
}

export function performanceConditionContext(data: PageSpeedResult, url: string, context: string) {
  const requestedKey = pageKey(url)
  return qualifyCondition(labConditionPrefix(requestedKey, currentLabMeasurement(data, requestedKey)), context)
}

/** Counts remain observable when old provider conditions are missing, but an
 * unscoped measurement can never certify recovery under new conditions. */
export function scopePerformanceFlags(data: PageSpeedResult, url: string | undefined, flags: DeterministicFlag[]) {
  const requestedKey = pageKey(url)
  const prefix = labConditionPrefix(requestedKey, currentLabMeasurement(data, requestedKey))
  return flags.map(flag => {
    const lab = performanceLabKey(flag.checkId)
    if (!lab && !flag.evidenceTargets?.length) return flag
    return { ...flag, ...(lab ? { verificationRule: PAGESPEED_LAB_RULE } : {}),
      evidenceTargets: (flag.evidenceTargets?.length ? flag.evidenceTargets : [{ kind: 'page' as const, source: 'measured' as const,
        device: data.strategy, label: 'PageSpeed lab measurement', context: 'lab:' + lab }]).map(target => ({ ...target,
        context: qualifyCondition(prefix, target.context ?? 'unknown') })) }
  })
}

export const PAGESPEED_LAB_UNAVAILABLE = 'PageSpeed did not return a current lab measurement for this page and device.'

export function scopePerformanceAssertions(data: PageSpeedResult, url: string, assertions: CheckAssertion[]) {
  const requestedKey = pageKey(url), measurement = currentLabMeasurement(data, requestedKey)
  const prefix = labConditionPrefix(requestedKey, measurement)
  return assertions.map(assertion => assertion.key === 'inp' ? assertion : { ...assertion,
    ...(!measurement ? { passed: false, complete: false, observed: `${PAGESPEED_LAB_UNAVAILABLE} ${assertion.observed}`.slice(0, 2000) } : {}),
    ...(['score', 'lcp', 'cls'].includes(assertion.key) || assertion.context ? { context: qualifyCondition(prefix, assertion.context ?? 'lab:' + assertion.key) } : {}),
    ...(assertion.measurements ? { measurements: assertion.measurements.map(item => ({ ...item,
      context: qualifyCondition(prefix, item.context) })) } : {}),
    ...(assertion.targets ? { targets: assertion.targets.map(target => ({ ...target,
      context: qualifyCondition(prefix, target.context ?? 'unknown') })) } : {}) })
}
