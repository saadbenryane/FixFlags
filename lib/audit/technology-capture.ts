import { z } from 'zod'
import { captureObservationScopeSchema } from './browser/observation-scope'
import { detectTechnologies, TECHNOLOGY_DETECTOR_VERSION } from './tech-detect'
import type { ScreenshotResult } from './screenshot'
import { documentEvidenceWithheld } from './browser/document-evidence'

export const technologyCaptureSchema = z.object({
  detectorVersion: z.string().min(1).max(80),
  status: z.enum(['COMPLETE', 'PARTIAL', 'UNAVAILABLE']),
  scope: captureObservationScopeSchema.nullable(),
  detections: z.array(z.object({
    name: z.string().min(1).max(120),
    kind: z.enum(['framework', 'builder', 'cms', 'commerce', 'hosting', 'analytics', 'monitoring', 'payments', 'support', 'security', 'form']),
    confidence: z.number().finite().min(0.8).max(1),
    evidence: z.array(z.object({ type: z.enum(['html', 'meta', 'header', 'resource', 'runtime']), label: z.string().max(120) }).strict()).max(4),
  }).strict()).max(100),
}).strict()

/** Assess the primary capture before private HTML is removed from its checkpoint.
 * An incomplete observation can establish presence, never removal. */
export function observeCapturedTechnologies(capture: ScreenshotResult): z.infer<typeof technologyCaptureSchema> {
  const html = capture.desktopHtml ?? '', resources = capture.technologyResources ?? [], markers = capture.technologyRuntimeMarkers ?? []
  const headers = capture.responseHeaders ?? {}
  const observed = Boolean(html || resources.length || markers.length || Object.keys(headers).length || capture.tracking?.requests.length)
  const complete = Boolean(html && capture.renderedScope && capture.responseHeaders && capture.technologyResources && capture.technologyRuntimeMarkers) &&
    html.length <= 2_000_000 && resources.length <= 300 && markers.length <= 32 &&
    !capture.desktopHtmlTruncated && !capture.desktopHtmlCompacted && !capture.technologyResourcesTruncated && !capture.tracking?.truncated &&
    !documentEvidenceWithheld(capture.collectionRestrictions) && !capture.captureFailures.some(failure => failure.device === 'desktop')
  return technologyCaptureSchema.parse({
    detectorVersion: TECHNOLOGY_DETECTOR_VERSION,
    status: complete ? 'COMPLETE' : observed ? 'PARTIAL' : 'UNAVAILABLE',
    scope: capture.renderedScope ?? null,
    detections: detectTechnologies(html, headers, resources, markers, capture.tracking),
  })
}
