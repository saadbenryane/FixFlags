export class JsonResponseError extends Error {
  constructor(readonly code: 'BODY_LIMIT' | 'BODY_UNAVAILABLE' | 'MALFORMED_JSON') { super(code); this.name = 'JsonResponseError' }
}

/** Consume bounded bytes, not an unbounded response.json() allocation. */
export async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_000_000) throw new Error('Invalid JSON response limit')
  const advertised = Number(response.headers.get('content-length'))
  if (advertised > maxBytes) { await response.body?.cancel(); throw new JsonResponseError('BODY_LIMIT') }
  const reader = response.body?.getReader()
  if (!reader) throw new JsonResponseError('BODY_UNAVAILABLE')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new JsonResponseError('BODY_LIMIT') }
      chunks.push(chunk.value)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { throw new JsonResponseError('MALFORMED_JSON') }
  } finally { reader.releaseLock() }
}
