export type McpCredentialResult =
  | { ok: true; key: string; scheme: 'bearer' | 'x-api-key' }
  | {
      ok: false
      code: 'MISSING_API_KEY' | 'INVALID_AUTHORIZATION' | 'CONFLICTING_API_KEYS'
      message: string
    }

export function extractMcpCredential(headers: Headers): McpCredentialResult {
  const authorization = headers.get('authorization')?.trim() ?? ''
  const headerKey = headers.get('x-api-key')?.trim() ?? ''
  let bearerKey = ''

  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization)
    if (!match) {
      return {
        ok: false,
        code: 'INVALID_AUTHORIZATION',
        message: 'Authorization must use the Bearer scheme.',
      }
    }
    bearerKey = match[1]
  }

  if (bearerKey && headerKey && bearerKey !== headerKey) {
    return {
      ok: false,
      code: 'CONFLICTING_API_KEYS',
      message: 'Authorization and x-api-key contain different credentials.',
    }
  }

  const key = bearerKey || headerKey
  if (!key) {
    return {
      ok: false,
      code: 'MISSING_API_KEY',
      message: 'Provide an Authorization: Bearer credential or x-api-key header.',
    }
  }

  return { ok: true, key, scheme: bearerKey ? 'bearer' : 'x-api-key' }
}
