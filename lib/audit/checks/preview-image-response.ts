import { z } from 'zod'
import sharp from 'sharp'
import { publicResponseRestriction } from '../browser/page-capture'

export const PREVIEW_IMAGE_MAX_BYTES = 5_000_000
const MAX_PIXELS = 16_000_000
const rasterFormatSchema = z.enum(['png', 'jpeg', 'webp', 'gif'])
type RasterFormat = z.infer<typeof rasterFormatSchema>
export const previewImageDecodingSchema = z.discriminatedUnion('state', [
  z.object({ version: z.literal(1), state: z.literal('decoded'), reason: z.literal('decoded'), format: rasterFormatSchema,
    width: z.number().int().positive(), height: z.number().int().positive(),
  }).strict().refine(value => value.width * value.height <= MAX_PIXELS, 'Decoded image exceeds pixel policy'),
  z.object({ version: z.literal(1), state: z.literal('invalid'), reason: z.literal('invalid_data'), format: rasterFormatSchema }).strict(),
  z.object({ version: z.literal(1), state: z.literal('unknown'),
    reason: z.enum(['unsupported_format', 'incomplete_body', 'byte_evidence_unavailable', 'resource_limit', 'execution_budget', 'response_unavailable']),
  }).strict(),
])
export const previewImageResponseSchema = z.object({ statusCode: z.number().int(), contentType: z.string(),
  hasContent: z.boolean(), complete: z.boolean(), restriction: z.enum(['authentication_required', 'access_denied', 'rate_limited', 'bot_challenge']).nullable(),
  decoding: previewImageDecodingSchema.optional() }).strict()
export type PreviewImageResponse = z.infer<typeof previewImageResponseSchema>
type Decoding = z.infer<typeof previewImageDecodingSchema>

/** Only bounded raster buffers reach the decoder. SVG and document loaders do not. */
function rasterFormat(bytes: Buffer): RasterFormat | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg'
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'gif'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
}

async function decodeImage(body: string | Buffer, complete: boolean, deadline = Infinity): Promise<Decoding> {
  const unknown = (reason: Extract<Decoding, { state: 'unknown' }>['reason']): Decoding => ({ version: 1, state: 'unknown', reason })
  if (!Buffer.isBuffer(body)) return unknown('byte_evidence_unavailable')
  if (!complete) return unknown('incomplete_body')
  if (body.length > PREVIEW_IMAGE_MAX_BYTES) return unknown('resource_limit')
  const format = rasterFormat(body)
  if (!format || !sharp.format[format].input.buffer) return unknown('unsupported_format')
  const budget = () => Math.min(2000, deadline - Date.now())
  if (budget() < 1000) return unknown('execution_budget')
  try {
    const image = sharp(body, { limitInputPixels: MAX_PIXELS, sequentialRead: true, failOn: 'error', pages: 1 })
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height) return { version: 1, state: 'invalid', reason: 'invalid_data', format }
    const decodeBudget = budget()
    if (decodeBudget < 1000) return unknown('execution_budget')
    // Header parsing alone cannot prove that the compressed pixels decode.
    await image.timeout({ seconds: Math.floor(decodeBudget / 1000) }).resize(1, 1).raw().toBuffer()
    if (Date.now() >= deadline) return unknown('execution_budget')
    return { version: 1, state: 'decoded', reason: 'decoded', format, width: metadata.width, height: metadata.height }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/pixel limit|out of memory|allocation|ENOMEM/i.test(message)) return unknown('resource_limit')
    if (/timed? ?out|timeout/i.test(message) || Date.now() >= deadline) return unknown('execution_budget')
    return { version: 1, state: 'invalid', reason: 'invalid_data', format }
  }
}

/** Collection discards bodies and credential-bearing headers after deriving
 * the bounded facts consumed by preview-image evaluation. */
export async function previewImageResponse(document: { statusCode: number; headers: Record<string, string>; body: string | Buffer; complete: boolean }, deadline?: number): Promise<PreviewImageResponse> {
  const contentType = document.headers['content-type']?.toLowerCase() ?? ''
  const bodyText = typeof document.body === 'string' ? document.body : document.body.subarray(0, 64_000).toString('utf8')
  const restriction = publicResponseRestriction({ status: document.statusCode, headers: document.headers, body: bodyText })
  const decoding = !restriction && document.statusCode >= 200 && document.statusCode < 300 && /^image\//.test(contentType) && document.body.length
    ? /^image\/svg\+xml(?:;|$)/.test(contentType)
      ? { version: 1 as const, state: 'unknown' as const, reason: 'unsupported_format' as const }
      : await decodeImage(document.body, document.complete, deadline)
    : { version: 1 as const, state: 'unknown' as const, reason: 'response_unavailable' as const }
  return { statusCode: document.statusCode, contentType,
    hasContent: document.body.length > 0, complete: document.complete,
    restriction, decoding }
}
