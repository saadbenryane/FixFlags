import { readFile } from 'node:fs/promises'
import { JWT } from 'google-auth-library'

export async function googleServiceAccount(scopes: string[]): Promise<JWT | null> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed.client_email && parsed.private_key) {
      return new JWT({ email: parsed.client_email, key: parsed.private_key, scopes })
    }
  } catch {}
  // `raw` is a path to a service-account JSON file: read it and build the JWT inline.
  // (JWT `keyFile` mode sends an empty `iss`, which Google rejects with invalid_grant.)
  const contents = await readFile(raw, 'utf8')
  const parsed = JSON.parse(contents) as { client_email?: string; private_key?: string }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(`Service account key file ${raw} is missing client_email or private_key`)
  }
  return new JWT({ email: parsed.client_email, key: parsed.private_key, scopes })
}
