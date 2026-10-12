import { z } from 'zod'
import { trackingEvidenceSchema } from '../tracking/contracts'
import { resourceTransportSchema } from '../resource-transport'
import { resourceAuditsSchema } from '../pagespeed-opportunities'
import { jsonValueSchema } from './contracts'
import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import { pageSpeedFailureSchema } from '../pagespeed'
import type { ScreenshotResult } from '../screenshot'

const text = z.string().max(1_000_000), strings = z.array(text).max(10_000)
const count = z.number().finite().nonnegative()
export const publicDocumentSchema = z.object({
  url: z.string().url(), finalUrl: z.string().url(), status: z.number().int().nullable(),
  headers: z.record(z.string(), z.string().max(32_000)), body: text.nullable(), complete: z.boolean(),
  reason: z.string().nullable(), collectedAt: z.string().datetime(), redirects: z.array(z.string().url()).max(5),
}).strict()
export const pageMetadataSchema = z.object({
  title: text.nullable(), description: text.nullable(), ogTitle: text.nullable(), ogDescription: text.nullable(),
  ogImage: text.nullable(), canonical: text.nullable(), lang: text.nullable(), viewport: text.nullable(), robots: text.nullable(),
  h1s: strings, h2s: strings, images: z.array(z.object({ src: text, alt: text.nullable() }).strict()).max(10_000),
  resourceTransport: resourceTransportSchema.optional(),
  imagesWithoutAlt: count, links: z.array(z.object({ href: text, text, rel: text.nullable() }).strict()).max(10_000),
  forms: count, inputsWithoutLabel: count, buttonsWithoutText: count, linksWithoutText: count, iframesWithoutTitle: count,
  positiveTabindex: count, ctaTexts: strings, hasStructuredData: z.boolean(), structuredDataTypes: strings,
  hasAnalytics: z.boolean(), hasCookieBasedAnalytics: z.boolean(), hasCookieConsent: z.boolean(),
  hasPrivacyPolicy: z.boolean(), hasContactInfo: z.boolean(), hasFavicon: z.boolean(), hasSkipLink: z.boolean(),
  navLandmarkCount: count, pageText: text, jsonLd: z.array(jsonValueSchema).max(50), elementIds: strings,
  formInputsMissingValidation: count, totalFormInputs: count, maxConversionFormInputs: count,
}).strict() satisfies z.ZodType<PageMetadata>
export const pageSpeedSchema = z.object({
  strategy: z.enum(['desktop', 'mobile']), score: z.number().finite().nullable(), lcp: z.number().finite().nullable(),
  cls: z.number().finite().nullable(), fcp: z.number().finite().nullable(), tbt: z.number().finite().nullable(), inp: z.number().finite().nullable(),
  opportunities: z.array(z.object({ id: text, title: text, savings: z.number().finite(), itemsCount: count.optional() }).strict()).max(100),
  resourceAudits: resourceAuditsSchema.optional(),
  failedAccessibilityAudits: z.array(z.object({ id: text, title: text, score: z.number().finite().nullable() }).strict()).max(500),
  diagnostics: z.record(z.string(), jsonValueSchema), raw: z.record(z.string(), jsonValueSchema),
  crux: z.object({ lcp: z.number().finite().nullable(), cls: z.number().finite().nullable(), fcp: z.number().finite().nullable(),
    inp: z.number().finite().nullable(), ttfb: z.number().finite().nullable(), formFactor: text.nullable(), effectiveConnectionType: text.nullable(),
    source: z.literal('pagespeed-loading-experience').optional(), scope: z.enum(['page', 'origin']).optional(),
    url: z.string().url().optional(), reportingWindowDays: z.literal(28).optional() }).strict().nullable(),
}).strict() satisfies z.ZodType<PageSpeedResult>
const object = z.record(z.string(), jsonValueSchema)
export const screenshotSnapshotSchema = z.object({
  desktopUrl: text.nullable(), mobileUrl: text.nullable(), desktopHtml: text.nullable(),
  desktopHtmlTruncated: z.boolean().optional(),
  desktopBase64: z.string().max(8_000_000).nullable(), mobileBase64: z.string().max(8_000_000).nullable(),
  desktopFinalUrl: z.string().url().optional(), desktopHttpStatus: z.number().int().nullable().optional(),
  originalDocument: publicDocumentSchema.optional(),
  consoleErrors: z.array(z.object({ type: text, text }).strict()).max(500),
  captureStatus: z.object({ desktop: z.enum(['ok', 'failed', 'pending']), mobile: z.enum(['ok', 'failed', 'pending']) }).strict(),
  captureFailures: z.array(object).max(10), captureMetrics: object.nullable().optional(), loadExperience: object.nullable().optional(),
  runtimeHeadMetadata: object.nullable().optional(), responseHeaders: z.record(z.string(), text).nullable().optional(),
  tracking: trackingEvidenceSchema.optional(),
  networkFailures: z.array(object).max(500).optional(), technologyResources: z.array(object).max(500).optional(),
  technologyResourcesTruncated: z.boolean().optional(), technologyRuntimeMarkers: strings.optional(), actionTimeline: z.array(object).max(500).optional(),
  formProbe: object.nullable().optional(), axeViolations: z.array(object).max(500).optional(), evidenceHarvest: z.array(object).max(500).optional(),
  collectionRestrictions: z.array(z.string().max(120)).max(16).optional(),
}).strict()
export function readScreenshotSnapshot(value: unknown): ScreenshotResult {
  // Explicit version-one adapter for the browser collector's nested diagnostic contracts.
  return screenshotSnapshotSchema.parse(value) as unknown as ScreenshotResult
}
export const httpArtifactSchema = z.object({ document: publicDocumentSchema, metadata: pageMetadataSchema.nullable() }).strict()
export const resourceArtifactSchema = z.object({
  robots: publicDocumentSchema, sitemaps: z.array(publicDocumentSchema).max(5), sitemapUrls: z.array(z.string().url()).max(10_000),
  complete: z.boolean(), declaredSitemaps: z.array(z.string()).max(10_000),
}).strict()
export const browserArtifactSchema = z.object({ pageId: z.string().min(1), snapshot: screenshotSnapshotSchema,
  metadata: pageMetadataSchema.nullable() }).strict()
export const captureArtifactSchema = z.object({ pageId: z.string().min(1), snapshot: screenshotSnapshotSchema }).strict()
export const speedArtifactSchema = z.object({ desktop: pageSpeedSchema.nullable(), mobile: pageSpeedSchema.nullable(),
  desktopError: text.optional(), mobileError: text.optional(),
  desktopFailure: pageSpeedFailureSchema.optional(), mobileFailure: pageSpeedFailureSchema.optional() }).strict()
