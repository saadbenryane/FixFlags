import { randomUUID, createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { decryptSecret, encryptSecret } from '../security/crypto'
import { parseScanAccessInput, scanAccessInputSchema, type ScanAccessConfig } from './scan-access'

import { scanAccessOriginSchema as originSchema } from './scan-access-intent'
const storedGrantSchema = z.object({ version: z.literal(2), kind: z.literal('scan-access-grant'), origin: originSchema,
  reference: z.string().min(1).max(80), config: scanAccessInputSchema, legacyCompatible: z.boolean().optional() }).strict()
const revokedGrantSchema = z.object({ version: z.literal(2), kind: z.literal('scan-access-revoked'), origin: originSchema,
  reference: z.string().min(1).max(80) }).strict()
export class ScanAccessUnavailable extends Error {
  readonly code = 'SCAN_ACCESS_CHANGED'
  constructor() { super('Website access changed. Start a new check to use the current settings.'); this.name = 'ScanAccessUnavailable' }
}
export type ProjectAccessGrant = { origin: string; reference: string; config: ScanAccessConfig | null; legacyCompatible: boolean }

/** The public revocation marker contains no credentials and needs no encryption key. */
export function readProjectAccessGrant(payload: string | null | undefined, projectUrl: string): ProjectAccessGrant {
  if (!payload) return { origin: new URL(projectUrl).origin, reference: 'public', config: null, legacyCompatible: false }
  try {
    if (payload.startsWith('{')) {
      const revoked = revokedGrantSchema.parse(JSON.parse(payload))
      return { ...revoked, config: null, legacyCompatible: false }
    }
    const value: unknown = JSON.parse(decryptSecret(payload))
    const stored = storedGrantSchema.safeParse(value)
    if (stored.success) {
      const config = parseScanAccessInput(stored.data.config)
      if (!config) throw new ScanAccessUnavailable()
      return { ...stored.data, config, legacyCompatible: stored.data.legacyCompatible === true }
    }
    if (value && typeof value === 'object' && 'version' in value) throw new ScanAccessUnavailable()
    const config = parseScanAccessInput(value)
    if (!config) throw new ScanAccessUnavailable()
    return { origin: new URL(projectUrl).origin, reference: createHash('sha256').update(payload).digest('hex'), config, legacyCompatible: true }
  } catch { throw new ScanAccessUnavailable() }
}
export function sameScanAccessCredentials(left: ScanAccessConfig | null, right: ScanAccessConfig | null) {
  const executable = (config: ScanAccessConfig | null) => config ? { httpBasic: config.httpBasic ?? null, cookies: config.cookies ?? [], headers: config.headers ?? {} } : null
  return isDeepStrictEqual(executable(left), executable(right))
}
export function writeProjectAccessGrant(config: ScanAccessConfig | null, projectUrl: string, previous?: ProjectAccessGrant) {
  const origin = new URL(projectUrl).origin
  const unchanged = previous?.origin === origin && sameScanAccessCredentials(previous.config, config)
  const reference = unchanged ? previous!.reference : randomUUID()
  const value = config ? { version: 2, kind: 'scan-access-grant', origin, reference, config,
    legacyCompatible: unchanged && previous?.legacyCompatible === true } : { version: 2, kind: 'scan-access-revoked', origin, reference }
  return { reference, payload: config ? encryptSecret(JSON.stringify(value)) : JSON.stringify(value), changed: !unchanged }
}
