import { z } from 'zod'
import { cruxEvidenceSchema } from '../crux'
import { renderedCopySchema } from '../browser/rendered-copy'
import { renderedSearchSnapshotSchema } from '../search/rendered-snapshot'
import { publicDocumentSchema, SITEMAP_DOCUMENT_LIMIT, SITEMAP_URL_LIMIT } from '../search/contracts'
export { publicDocumentSchema } from '../search/contracts'
import { trackingEvidenceSchema } from '../tracking/contracts'
import { resourceTransportSchema } from '../resource-transport'
import { resourceAuditsSchema } from '../pagespeed-opportunities'
import { tapTargetAuditsSchema } from '../pagespeed-tap-targets'
import { consoleCoverageSchema } from '../console-evidence'
import { accessibilityEvidenceSchema } from '../browser/accessibility-evidence'
import { captureObservationScopeSchema } from '../browser/observation-scope'
import { motionWindowSchema } from '../checks/motion-evidence'
import { jsonValueSchema } from '@/lib/json-value'
import { technologyCaptureSchema } from '../technology-capture'
import { pagePreviewSchema } from '../checks/page-preview'
import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import { pageSpeedFailureSchema } from '../pagespeed'
import type { ScreenshotResult } from '../screenshot'

const text = z.string().max(1_000_000), strings = z.array(text).max(10_000)
const count = z.number().finite().nonnegative()
export const pageMetadataSchema = z.object({
  renderedCopy: renderedCopySchema.nullable().optional(),
  linkBaseUrl: z.string().url().optional(),
  documentUrl: z.string().url().optional(),
  title: text.nullable(), description: text.nullable(), ogTitle: text.nullable(), ogDescription: text.nullable(),
  ogImage: text.nullable(), canonical: text.nullable(), lang: text.nullable(), viewport: text.nullable(), robots: text.nullable(),
  h1s: strings, h2s: strings, images: z.array(z.object({ src: text, alt: text.nullable() }).strict()).max(10_000),
  resourceTransport: resourceTransportSchema.optional(),
  imagesWithoutAlt: count, links: z.array(z.object({ href: text, text, rel: text.nullable() }).strict()).max(10_000),
  documentLinks: z.array(z.object({ href: text, text }).strict()).max(10_000).optional(),
  forms: count, inputsWithoutLabel: count, buttonsWithoutText: count, linksWithoutText: count, iframesWithoutTitle: count,
  positiveTabindex: count, ctaTexts: strings, hasStructuredData: z.boolean(), structuredDataTypes: strings,
  hasAnalytics: z.boolean(), hasCookieBasedAnalytics: z.boolean(), hasCookieConsent: z.boolean(),
  hasPrivacyPolicy: z.boolean(), hasContactInfo: z.boolean(), hasFavicon: z.boolean(), hasSkipLink: z.boolean(),
  navLandmarkCount: count, pageText: text, jsonLd: z.array(jsonValueSchema).max(50), elementIds: strings,
  anchorNames: strings.optional(), testimonialBlocks: z.array(z.object({ quote: text, attribution: z.string().max(1200).nullable() }).strict()).max(1000).optional(),
  formInputsMissingValidation: count, totalFormInputs: count, maxConversionFormInputs: count,
}).strict() satisfies z.ZodType<PageMetadata>
export const pageSpeedSchema = z.object({
  strategy: z.enum(['desktop', 'mobile']), score: z.number().finite().nullable(), lcp: z.number().finite().nullable(),
  cls: z.number().finite().nullable(), fcp: z.number().finite().nullable(), tbt: z.number().finite().nullable(), inp: z.number().finite().nullable(),
  opportunities: z.array(z.object({ id: text, title: text, savings: z.number().finite(), itemsCount: count.optional() }).strict()).max(100),
  resourceAudits: resourceAuditsSchema.optional(),
  tapTargetAudits: tapTargetAuditsSchema.optional(),
  failedAccessibilityAudits: z.array(z.object({ id: text, title: text, score: z.number().finite().nullable() }).strict()).max(500),
  diagnostics: z.record(z.string(), jsonValueSchema), raw: z.record(z.string(), jsonValueSchema),
  crux: cruxEvidenceSchema.nullable(),
}).strict() satisfies z.ZodType<PageSpeedResult>
const object = z.record(z.string(), jsonValueSchema)
export const screenshotSnapshotSchema = z.object({
  desktopUrl: text.nullable(), mobileUrl: text.nullable(), desktopHtml: text.nullable(),
  desktopHtmlTruncated: z.boolean().optional(), desktopHtmlCompacted: z.boolean().optional(), renderedSearchSnapshot: renderedSearchSnapshotSchema.optional(),
  desktopBase64: z.string().max(8_000_000).nullable(), mobileBase64: z.string().max(8_000_000).nullable(),
  desktopFinalUrl: z.string().url().optional(), desktopHttpStatus: z.number().int().nullable().optional(),
  originalDocument: publicDocumentSchema.optional(),
  consoleErrors: z.array(z.object({ type: text, text, identity: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()).max(500),
  consoleCoverage: consoleCoverageSchema.optional(),
  accessibilityEvidence: accessibilityEvidenceSchema.optional(), renderedScope: captureObservationScopeSchema.optional(),
  mobileAccessibility: z.object({ evidence: accessibilityEvidenceSchema.optional(), violations: z.array(object).max(500).optional() }).strict().optional(),
  captureStatus: z.object({ desktop: z.enum(['ok', 'failed', 'pending']), mobile: z.enum(['ok', 'failed', 'pending']) }).strict(),
  captureFailures: z.array(object).max(10), captureMetrics: object.nullable().optional(), loadExperience: object.nullable().optional(),
  motionWindow: motionWindowSchema.optional(),
  runtimeHeadMetadata: object.nullable().optional(), renderedCopy: renderedCopySchema.nullable().optional(), responseHeaders: z.record(z.string(), text).nullable().optional(),
  runtimeHeadScope: captureObservationScopeSchema.optional(),
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
const metadataFailureSchema = z.object({ code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/), attempts: z.number().int().min(1).max(2) }).strict()
export type MetadataFailure = z.infer<typeof metadataFailureSchema>
export const httpArtifactSchema = z.object({ document: publicDocumentSchema, metadata: pageMetadataSchema.nullable(), metadataFailure: metadataFailureSchema.optional() }).strict()
export const resourceArtifactSchema = z.object({
  robots: publicDocumentSchema, sitemaps: z.array(publicDocumentSchema).max(SITEMAP_DOCUMENT_LIMIT), sitemapUrls: z.array(z.string().url()).max(SITEMAP_URL_LIMIT),
  complete: z.boolean(), declaredSitemaps: z.array(z.string()).max(SITEMAP_URL_LIMIT),
}).strict()
export const browserArtifactSchema = z.object({ pageId: z.string().min(1), snapshot: screenshotSnapshotSchema,
  preview: pagePreviewSchema.optional(),
  technologies: technologyCaptureSchema.optional(),
  metadata: pageMetadataSchema.nullable(), metadataFailure: metadataFailureSchema.optional() }).strict()
export const captureArtifactSchema = z.object({ pageId: z.string().min(1), snapshot: screenshotSnapshotSchema }).strict()
export const speedArtifactSchema = z.object({ desktop: pageSpeedSchema.nullable(), mobile: pageSpeedSchema.nullable(),
  desktopError: text.optional(), mobileError: text.optional(),
  desktopFailure: pageSpeedFailureSchema.optional(), mobileFailure: pageSpeedFailureSchema.optional() }).strict()
