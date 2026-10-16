import { z } from 'zod'
import type { RuntimeHeadMetadata } from '../metadata'
import type { ScreenshotResult } from '../screenshot'
import { captureObservationScopeSchema, type CaptureObservationScope } from '../browser/observation-scope'

export const NATIVE_HEAD_TEXT_LIMIT = 8000
const text = z.string().max(NATIVE_HEAD_TEXT_LIMIT).nullable()
const fields = ['title', 'description', 'ogTitle', 'ogDescription', 'ogImage', 'canonical', 'lang', 'viewport', 'robots'] as const
export type HeadMetadataObservation = { metadata: RuntimeHeadMetadata; scope: CaptureObservationScope }

/** Native fields have independent bounds. An unavailable field cannot become
 * absence, and a large body cannot erase a successfully observed head. */
export function capturedHeadMetadata(capture: Pick<ScreenshotResult,
  'runtimeHeadMetadata' | 'runtimeHeadScope' | 'collectionRestrictions' | 'desktopFinalUrl'> | null | undefined): HeadMetadataObservation | undefined {
  if (!capture?.runtimeHeadMetadata) return undefined
  const scope = captureObservationScopeSchema.safeParse(capture.runtimeHeadScope)
  if (!scope.success || capture.desktopFinalUrl && new URL(capture.desktopFinalUrl).href !== new URL(scope.data.finalUrl).href) return undefined
  const metadata: RuntimeHeadMetadata = {}
  if (!capture.collectionRestrictions?.length) {
    for (const field of fields) {
      const value = text.safeParse(capture.runtimeHeadMetadata[field])
      if (value.success) metadata[field] = value.data?.trim() || null
    }
    const favicon = z.boolean().safeParse(capture.runtimeHeadMetadata.hasFavicon)
    if (favicon.success) metadata.hasFavicon = favicon.data
  }
  return { metadata, scope: scope.data }
}
