import { access } from 'node:fs/promises'
import { JWT } from 'google-auth-library'

export async function googleServiceAccount(scopes: string[]): Promise<JWT | null> {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY?.trim()
  if (!keyPath) return null
  await access(keyPath)
  return new JWT({ keyFile: keyPath, scopes })
}
