import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
const VERSION = 1
const N = 16_384
const R = 8
const P = 1
const KEY_LENGTH = 32
const MAX_MEMORY = 64 * 1024 * 1024

function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

/** Versioned asynchronous scrypt hash. Parameters travel with the stored hash. */
export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await deriveKey(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  })
  return `scrypt$v=${VERSION}$N=${N},r=${R},p=${P}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function verifySharePassword(
  stored: string | null | undefined,
  candidate: string
): Promise<boolean> {
  if (!stored) return false
  const [algorithm, versionRaw, paramsRaw, saltRaw, hashRaw, extra] = stored.split('$')
  if (algorithm !== 'scrypt' || versionRaw !== `v=${VERSION}` || !paramsRaw || !saltRaw || !hashRaw || extra) {
    return false
  }
  const params = Object.fromEntries(
    paramsRaw.split(',').map((part) => part.split('='))
  ) as Record<string, string>
  const parsedN = Number(params.N)
  const parsedR = Number(params.r)
  const parsedP = Number(params.p)
  if (parsedN !== N || parsedR !== R || parsedP !== P) return false

  try {
    const expected = Buffer.from(hashRaw, 'base64url')
    const derived = await deriveKey(candidate, Buffer.from(saltRaw, 'base64url'), expected.length, {
      N: parsedN,
      r: parsedR,
      p: parsedP,
      maxmem: MAX_MEMORY,
    })
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}
