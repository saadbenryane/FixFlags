import { createHash } from 'node:crypto'
import { z } from 'zod'
import { openCheckDestination, OPEN_CHECK_OUTCOMES } from './open-check'
import { safeFetchDocument } from './url'
import type { DestinationCheckOptions } from './checks/destination-evidence'

const destinationSchema = z.object({ url: z.string(), canonicalUrl: z.string(), outcome: z.enum(OPEN_CHECK_OUTCOMES),
  status: z.number().int().nullable(), finalUrl: z.string().nullable(), evidence: z.string(), shouldFlagDead: z.boolean() }).strict()
const documentSchema = z.object({ statusCode: z.number().int(), headers: z.object({ 'content-type': z.string().optional(), 'cf-mitigated': z.string().optional() }).strict(),
  body: z.string().max(64_000), complete: z.boolean() }).strict()
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('destination'), key: z.string(), result: destinationSchema }).strict(),
  z.object({ kind: z.literal('document'), key: z.string(), result: documentSchema.nullable() }).strict(),
])
export const nativeHttpEvidenceSchema = z.object({ version: z.literal(1), evaluatedAt: z.string().datetime(),
  requests: z.array(requestSchema).max(128) }).strict()
export type NativeHttpEvidence = z.infer<typeof nativeHttpEvidenceSchema>
type Request = z.infer<typeof requestSchema>

/** Retain only consumed HTTP inputs in the private task artifact. Request headers
 * and response cookies are excluded. Replay has no network path. */
export function nativeHttpCollection(recorded?: NativeHttpEvidence) {
  const replay = recorded ? nativeHttpEvidenceSchema.parse(recorded) : null
  const requests: Request[] = [], consumed = new Set<number>()
  let evaluatedAt = replay?.evaluatedAt ?? new Date().toISOString(), mismatch = false
  const identity = (kind: string, url: string, options: unknown) => createHash('sha256').update(JSON.stringify([kind, url, options])).digest('hex')
  function read(kind: Request['kind'], key: string): Request {
    const index = replay!.requests.findIndex((request, index) => !consumed.has(index) && request.kind === kind && request.key === key)
    if (index < 0) { mismatch = true; throw new Error('NATIVE_HTTP_REPLAY_INPUT_MISSING') }
    consumed.add(index)
    return structuredClone(replay!.requests[index])
  }
  const collectedAt = () => {
    if (!replay) evaluatedAt = new Date().toISOString()
    return evaluatedAt
  }
  const openDestination: typeof openCheckDestination = async (url, options = {}) => {
    const key = identity('destination', url, [options.origin ?? null, options.httpErrorsOnly ?? false])
    if (replay) return (read('destination', key) as Extract<Request, { kind: 'destination' }>).result
    const result = await openCheckDestination(url, options)
    requests.push({ kind: 'destination', key, result: destinationSchema.parse(result) })
    return result
  }
  const fetchDocument: NonNullable<DestinationCheckOptions['fetchDocument']> = async (url, options) => {
    const key = identity('document', url, [options.maxBytes, options.accept])
    if (replay) {
      const result = (read('document', key) as Extract<Request, { kind: 'document' }>).result
      if (!result) throw new Error('Recorded HTTP response unavailable')
      return result
    }
    let result: z.infer<typeof documentSchema> | null = null
    try {
      const document = await safeFetchDocument(url, options)
      result = documentSchema.parse({ statusCode: document.statusCode, body: document.body, complete: document.complete,
        headers: Object.fromEntries(['content-type', 'cf-mitigated'].filter(key => document.headers[key] !== undefined)
          .map(key => [key, document.headers[key]])) })
      return result
    } finally { requests.push({ kind: 'document', key, result }) }
  }
  return { options: { openDestination, fetchDocument, collectedAt }, snapshot(): NativeHttpEvidence {
    if (replay && (mismatch || consumed.size !== replay.requests.length)) throw new Error('NATIVE_HTTP_REPLAY_INPUT_MISMATCH')
    return nativeHttpEvidenceSchema.parse(replay ?? { version: 1, evaluatedAt, requests })
  } }
}
