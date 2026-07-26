import open from 'open'
import { API_BASE, readSecretFromStdin, saveCredential } from './credentials.js'

interface ApiError {
  code?: string
  message?: string
  retryAfter?: number
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) throw new Error(`FixFlags returned HTTP ${response.status}`)
  return body
}

export async function fetchIdentity(apiKey: string) {
  const response = await fetch(`${API_BASE}/api/cli/auth/session`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const body = await responseBody(response)
  if (!response.ok) {
    throw new Error(String(body.message || 'That FixFlags credential is not valid.'))
  }
  return body as {
    user: { id: string; email: string; name?: string | null; plan: string }
    credential: { id: string; client?: string | null }
  }
}

export async function loginWithToken(options: { insecureStorage?: boolean }) {
  const apiKey = await readSecretFromStdin('Paste your FixFlags API key: ')
  if (!apiKey) throw new Error('No API key was provided.')
  const identity = await fetchIdentity(apiKey)
  saveCredential(apiKey, options)
  return identity
}

export async function loginWithBrowser(options: { insecureStorage?: boolean }) {
  const response = await fetch(`${API_BASE}/api/cli/auth/device`, { method: 'POST' })
  const body = await responseBody(response)
  if (!response.ok) {
    throw new Error(String(body.message || 'Could not start browser login.'))
  }
  const deviceCode = String(body.deviceCode || '')
  const userCode = String(body.userCode || '')
  const verificationUriComplete = String(body.verificationUriComplete || '')
  const expiresIn = Number(body.expiresIn || 600)
  let interval = Number(body.interval || 5)
  if (!deviceCode || !verificationUriComplete) {
    throw new Error('FixFlags returned an incomplete browser login response.')
  }

  console.log(`Code: ${userCode}`)
  console.log(`Open: ${verificationUriComplete}`)
  if (process.env.FIXFLAGS_NO_OPEN !== '1') {
    await open(verificationUriComplete)
  }

  const deadline = Date.now() + expiresIn * 1000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))
    const tokenResponse = await fetch(`${API_BASE}/api/cli/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode }),
    })
    const tokenBody = (await responseBody(tokenResponse)) as ApiError & {
      accessToken?: string
    }
    if (tokenResponse.ok && tokenBody.accessToken) {
      const identity = await fetchIdentity(tokenBody.accessToken)
      saveCredential(tokenBody.accessToken, options)
      return identity
    }
    if (tokenBody.code === 'AUTHORIZATION_PENDING') continue
    if (tokenBody.code === 'SLOW_DOWN') {
      interval = Math.max(
        interval,
        Number(tokenResponse.headers.get('retry-after') || interval) + 1
      )
      continue
    }
    if (tokenBody.code === 'ACCESS_DENIED') {
      throw new Error('Browser login was denied.')
    }
    if (tokenBody.code === 'EXPIRED_DEVICE_CODE') {
      throw new Error('Browser login expired. Run fixflags login again.')
    }
    throw new Error(String(tokenBody.message || 'Browser login failed.'))
  }
  throw new Error('Browser login expired. Run fixflags login again.')
}

export async function revokeCredential(apiKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cli/auth/session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok && response.status !== 401) {
    const body = await responseBody(response)
    throw new Error(String(body.message || 'Could not revoke the CLI credential.'))
  }
}
