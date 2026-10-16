import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeVerifierUrl } from '../improvements/verifier-scope'

const OPPORTUNITY_DEFINITIONS = [
  { id: 'render-blocking-resources', aliases: ['render-blocking-insight', 'render-blocking-resources'], unit: 'ms' },
  { id: 'unused-javascript', aliases: ['unused-javascript'], unit: 'bytes' },
  { id: 'unused-css-rules', aliases: ['unused-css-rules'], unit: 'bytes' },
  { id: 'uses-optimized-images', aliases: ['image-delivery-insight', 'uses-optimized-images'], unit: 'bytes' },
  { id: 'uses-webp-images', aliases: ['modern-image-formats', 'uses-webp-images'], unit: 'bytes' },
  { id: 'uses-responsive-images', aliases: ['uses-responsive-images'], unit: 'bytes' },
  { id: 'efficient-animated-content', aliases: ['efficient-animated-content'], unit: 'bytes' },
  { id: 'uses-text-compression', aliases: ['uses-text-compression'], unit: 'bytes' },
] as const

export const resourceAuditSchema = z.object({
  id: z.enum(OPPORTUNITY_DEFINITIONS.map(definition => definition.id)),
  providerAuditId: z.string().min(1).max(100), title: z.string().max(1000),
  unit: z.enum(['ms', 'bytes']), score: z.number().finite().min(0).max(1).nullable(),
  savings: z.number().finite().nonnegative().nullable(),
}).strict().superRefine((audit, context) => {
  const definition = OPPORTUNITY_DEFINITIONS.find(item => item.id === audit.id)!
  if (audit.unit !== definition.unit || !definition.aliases.some(alias => alias === audit.providerAuditId))
    context.addIssue({ code: 'custom', message: 'Resource audit identity and unit do not match' })
})
export type ResourceAudit = z.infer<typeof resourceAuditSchema>
export const resourceAuditsSchema = z.array(resourceAuditSchema).max(8).superRefine((audits, context) => {
  if (new Set(audits.map(audit => audit.id)).size !== audits.length)
    context.addIssue({ code: 'custom', message: 'Duplicate resource audit identity' })
})

export const PERFORMANCE_RESOURCE_THRESHOLDS = { renderBlocking: 500, unusedJavascript: 100_000, unusedCss: 50_000, images: 50_000 } as const
export const LEGACY_IMAGE_AUDITS = ['uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'efficient-animated-content'] as const

export const RESOURCE_REPAIR_RULE = 'PageSpeed resource observation v1: repeat the original provider audits, device, units and thresholds.'
export const RESOURCE_CHECK_POLICIES = {
  'render-blocking': { key: 'render-blocking', name: 'Render-blocking resources', ids: ['render-blocking-resources'], threshold: PERFORMANCE_RESOURCE_THRESHOLDS.renderBlocking, unit: 'ms' },
  'unused-js-large': { key: 'unused-javascript', name: 'Unused JavaScript', ids: ['unused-javascript'], threshold: PERFORMANCE_RESOURCE_THRESHOLDS.unusedJavascript, unit: 'bytes' },
  'unused-css-large': { key: 'unused-css', name: 'Unused CSS', ids: ['unused-css-rules'], threshold: PERFORMANCE_RESOURCE_THRESHOLDS.unusedCss, unit: 'bytes' },
  'unoptimized-images': { key: 'image-optimization', name: 'Image delivery', ids: LEGACY_IMAGE_AUDITS, threshold: PERFORMANCE_RESOURCE_THRESHOLDS.images, unit: 'bytes' },
} as const

export function resourceCheckPolicy(checkId: string) {
  const id = checkId.replace(/^mobile-/, '')
  return Object.hasOwn(RESOURCE_CHECK_POLICIES, id) ? RESOURCE_CHECK_POLICIES[id as keyof typeof RESOURCE_CHECK_POLICIES] : undefined
}

export function resourcePageKey(pageUrl: string) {
  return createHash('sha256').update(normalizeVerifierUrl(pageUrl)).digest('hex')
}

export function resourceAuditContext(pageUrl: string, device: 'desktop' | 'mobile', audit: Pick<ResourceAudit, 'providerAuditId' | 'unit'>, threshold: number) {
  return `pagespeed-resource:v1:${resourcePageKey(pageUrl)}:${device}:${audit.providerAuditId}:${audit.unit}:${threshold}`
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Retain successful measurements alongside failures. Missing or failed provider
 * audits never become zero savings. No resource URLs or DOM snippets are copied. */
export function readResourceAudits(audits: Record<string, Record<string, unknown>>): ResourceAudit[] {
  return OPPORTUNITY_DEFINITIONS.flatMap(({ id, aliases, unit }) => {
    const providerAuditId = aliases.find(alias => audits[alias])
    if (!providerAuditId) return []
    if (['uses-webp-images', 'uses-responsive-images', 'efficient-animated-content'].includes(id) && audits['image-delivery-insight']) return []
    const audit = audits[providerAuditId]
    const details = audit.details as Record<string, unknown> | undefined
    const debug = details?.debugData as Record<string, unknown> | undefined
    const metrics = audit.metricSavings as Record<string, unknown> | undefined
    const measured = typeof audit.score === 'number' && !audit.errorMessage && !audit.notApplicable &&
      !['error', 'notApplicable', 'informative', 'manual'].includes(String(audit.scoreDisplayMode))
    const score = measured ? audit.score as number : null
    let savings = !measured ? null : unit === 'ms'
      ? nonnegativeNumber(metrics?.FCP) ?? nonnegativeNumber(details?.overallSavingsMs)
      : nonnegativeNumber(details?.overallSavingsBytes) ?? nonnegativeNumber(debug?.wastedBytes)
    // A successful, explicitly empty results table proves no matching resources.
    // Lighthouse can also return N/A when an insight model is missing, so N/A
    // alone cannot establish that the old problem recovered.
    if (savings === null && score === 1 && ['table', 'opportunity'].includes(String(details?.type)) &&
      Array.isArray(details?.items) && details.items.length === 0) savings = 0
    return [{ id, providerAuditId, unit, score, savings,
      title: (typeof audit.title === 'string' ? audit.title : providerAuditId).slice(0, 1000) }]
  })
}

/** Preserve the established failed-opportunity projection for reports and checks. */
export function projectResourceOpportunities(audits: ResourceAudit[]) {
  return audits.flatMap(audit => audit.score !== null && audit.score < 1 && audit.savings !== null
    ? [{ id: audit.id, title: audit.title, savings: Math.round(audit.savings) }] : [])
}
