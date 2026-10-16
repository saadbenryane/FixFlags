import { z } from 'zod'
import { captureObservationScopeSchema } from '../browser/observation-scope'
import type { ScreenshotResult } from '../screenshot'
import type { CorridorPageMeta } from './corridor-consistency'
import type { PageMetadata } from '../metadata'
import { capturedHeadMetadata, NATIVE_HEAD_TEXT_LIMIT } from './head-metadata'

const previewText = z.string().max(NATIVE_HEAD_TEXT_LIMIT).nullable()
export const pagePreviewSchema = z.object({
  version: z.literal(1), scope: captureObservationScopeSchema,
  title: previewText, ogTitle: previewText, ogDescription: previewText,
  titleComplete: z.boolean(), descriptionComplete: z.boolean(),
}).strict()
export type PagePreviewObservation = z.infer<typeof pagePreviewSchema>

/** Head values belong to their own native observation, independently of DOM
 * parsing. Missing, oversized or restricted fields cannot establish absence. */
export function capturedPagePreview(capture: Pick<ScreenshotResult, 'runtimeHeadMetadata' | 'runtimeHeadScope' | 'collectionRestrictions'> | null | undefined): PagePreviewObservation | undefined {
  const head = capturedHeadMetadata(capture)
  if (!head) return undefined
  const { title, ogTitle, ogDescription } = head.metadata
  return { version: 1, scope: head.scope,
    title: title ?? null, ogTitle: ogTitle ?? null, ogDescription: ogDescription ?? null,
    titleComplete: title !== undefined && ogTitle !== undefined,
    descriptionComplete: ogDescription !== undefined }
}

export function pagePreviewForComparison(page: { url: string; preview?: PagePreviewObservation;
  metadata: Pick<PageMetadata, 'title' | 'ogTitle' | 'ogDescription'> | null;
  renderedScope?: ScreenshotResult['renderedScope'] }, role: string): CorridorPageMeta {
  const preview = page.preview
  return { url: page.url, role,
    title: preview ? preview.title : page.metadata?.title ?? null,
    ogTitle: preview ? preview.ogTitle : page.metadata?.ogTitle ?? null,
    ogDescription: preview ? preview.ogDescription : page.metadata?.ogDescription ?? null,
    scope: preview ? preview.scope : page.renderedScope,
    titleComplete: preview ? preview.titleComplete : Boolean(page.metadata),
    descriptionComplete: preview ? preview.descriptionComplete : Boolean(page.metadata),
    ...(preview ? { source: 'native-head-v1' as const } : {}) }
}
