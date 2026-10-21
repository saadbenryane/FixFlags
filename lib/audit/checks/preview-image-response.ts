import { z } from 'zod'
import { publicResponseRestriction } from '../browser/page-capture'

export const previewImageResponseSchema = z.object({ statusCode: z.number().int(), contentType: z.string(),
  hasContent: z.boolean(), complete: z.boolean(), restriction: z.enum(['authentication_required', 'access_denied', 'rate_limited', 'bot_challenge']).nullable() }).strict()
export type PreviewImageResponse = z.infer<typeof previewImageResponseSchema>

/** Collection discards bodies and credential-bearing headers after deriving
 * the bounded facts consumed by preview-image evaluation. */
export function previewImageResponse(document: { statusCode: number; headers: Record<string, string>; body: string; complete: boolean }): PreviewImageResponse {
  return { statusCode: document.statusCode, contentType: document.headers['content-type']?.toLowerCase() ?? '',
    hasContent: document.body.length > 0, complete: document.complete,
    restriction: publicResponseRestriction({ status: document.statusCode, headers: document.headers, body: document.body }) }
}
