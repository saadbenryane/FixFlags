import { access } from 'node:fs/promises'
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
  await access(raw)
  return new JWT({ keyFile: raw, scopes })
}
