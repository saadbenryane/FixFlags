import { createHash } from 'node:crypto'
import { z } from 'zod'
import { openCheckDestination, OPEN_CHECK_OUTCOMES, publicGetSucceeded } from './open-check'
import { safeFetchResource } from './url'
import type { DestinationCheckOptions } from './checks/destination-evidence'
import { previewImageResponse, previewImageResponseSchema } from './checks/preview-image-response'

const destinationSchema = z.object({ outcome: z.enum(OPEN_CHECK_OUTCOMES), status: z.number().int().nullable(), shouldFlagDead: z.boolean() }).strict()
const requestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('destination'), key: z.string(), result: destinationSchema.nullable() }).strict(),
  z.object({ kind: z.literal('document'), key: z.string(), result: previewImageResponseSchema.nullable() }).strict(),
])
export const nativeHttpEvidenceSchema = z.object({ version: z.literal(1), evaluatedAt: z.string().datetime(),
  requests: z.array(requestSchema).max(128) }).strict()
export type NativeHttpEvidence = z.infer<typeof nativeHttpEvidenceSchema>
type Request = z.infer<typeof requestSchema>
const identity = (kind: string, url: string, options: unknown) => createHash('sha256').update(JSON.stringify([kind, url, options])).digest('hex')

/** Reuse a conclusive public GET only for its exact recorded request conditions.
 * Missing, repeated or uncertain inputs still require a new observation. The
 * caller owns selection of a compatible checkpoint from the same analysis. */
export function recordedPublicDestinations(recorded: NativeHttpEvidence) {
  const byKey = new Map<string, Extract<Request, { kind: 'destination' }> | undefined>()
  for (const request of nativeHttpEvidenceSchema.parse(recorded).requests) if (request.kind === 'destination')
    byKey.set(request.key, byKey.has(request.key) ? undefined : request)
  return (url: string, options: Pick<NonNullable<Parameters<typeof openCheckDestination>[1]>, 'origin' | 'httpErrorsOnly'> = {}) => {
    const result = byKey.get(identity('destination', url, [options.origin ?? null, options.httpErrorsOnly ?? false]))?.result
    return result && (publicGetSucceeded(result) || result.shouldFlagDead)
      ? { url: new URL(url, options.origin).toString(), ...result } : undefined
  }
}

/** Retain consumed decision inputs and hashed request identities. Raw URLs,
 * response bodies and credential-bearing headers are excluded. Replay has no network path. */
export function nativeHttpCollection(recorded?: NativeHttpEvidence) {
  const replay = recorded ? nativeHttpEvidenceSchema.parse(recorded) : null
  const requests: Request[] = [], consumed = new Set<number>()
  let evaluatedAt = replay?.evaluatedAt ?? new Date().toISOString(), mismatch = false
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
  const openDestination: NonNullable<DestinationCheckOptions['openDestination']> = async (url, options = {}) => {
    const key = identity('destination', url, [options.origin ?? null, options.httpErrorsOnly ?? false])
    if (replay) {
      const result = (read('destination', key) as Extract<Request, { kind: 'destination' }>).result
      if (!result) throw new Error('Recorded HTTP response unavailable')
      return { url: new URL(url, options.origin).toString(), ...result }
    }
    let observed: z.infer<typeof destinationSchema> | null = null
    try {
      const result = await openCheckDestination(url, options)
      observed = { outcome: result.outcome, status: result.status, shouldFlagDead: result.shouldFlagDead }
      return result
    } finally { requests.push({ kind: 'destination', key, result: observed }) }
  }
  const observeImage: NonNullable<DestinationCheckOptions['observeImage']> = async (url, options) => {
    const key = identity('document', url, [options.maxBytes, options.accept])
    if (replay) {
      const result = (read('document', key) as Extract<Request, { kind: 'document' }>).result
      if (!result) throw new Error('Recorded HTTP response unavailable')
      return result
    }
    let result: z.infer<typeof previewImageResponseSchema> | null = null
    try {
      const document = await safeFetchResource(url, options)
      result = await previewImageResponse(document, options.deadline)
      return result
    } finally { requests.push({ kind: 'document', key, result }) }
  }
  return { options: { openDestination, observeImage, collectedAt }, snapshot(): NativeHttpEvidence {
    if (replay && (mismatch || consumed.size !== replay.requests.length)) throw new Error('NATIVE_HTTP_REPLAY_INPUT_MISMATCH')
    return nativeHttpEvidenceSchema.parse(replay ?? { version: 1, evaluatedAt, requests })
  } }
}
