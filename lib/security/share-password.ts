import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const PREFIX = 'scrypt'
const KEYLEN = 32

/** Hash a share-link password for storage. Never store plaintext. */
export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return `${PREFIX}$${salt}$${hash}`
}

/** Verify a candidate against the only supported stored format. */
export function verifySharePassword(
  stored: string | null | undefined,
  candidate: string
): boolean {
  if (!stored?.startsWith(`${PREFIX}$`)) return false
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const candidateHash = scryptSync(candidate, salt, KEYLEN)
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== candidateHash.length) return false
  return timingSafeEqual(expected, candidateHash)
}
