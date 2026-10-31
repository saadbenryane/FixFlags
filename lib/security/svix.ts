import { createHmac, timingSafeEqual } from 'node:crypto'

/** Svix signs the original bytes, message identity and bounded timestamp. */
export function verifySvixSignature(payload: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('svix-id'), timestamp = headers.get('svix-timestamp'), signatures = headers.get('svix-signature')
  if (!id || id.length > 200 || !timestamp || timestamp.length > 15 || !/^\d+$/.test(timestamp) || !signatures || signatures.length > 2048 || !secret.startsWith('whsec_') ||
    Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const key = Buffer.from(secret.slice(6), 'base64')
  if (key.length < 16) return false
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest()
  return signatures.split(' ').some(signature => {
    const [version, raw] = signature.split(',')
    if (version !== 'v1' || !raw) return false
    const actual = Buffer.from(raw, 'base64')
    return actual.length === expected.length && timingSafeEqual(expected, actual)
  })
}
