import { parseApiErrorResponse } from '@/lib/api/parse-error'
import type { ApiKeyClient } from '@/lib/mcp/builders'

export interface CreatedApiKey {
  id: string
  name: string
  key: string
  prefix: string
  lastFour: string
  client: ApiKeyClient | null
}

export async function createApiKey(input: {
  name?: string
  client?: ApiKeyClient
} = {}): Promise<CreatedApiKey> {
  const response = await fetch('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error((await parseApiErrorResponse(response)).message)
  }
  return response.json() as Promise<CreatedApiKey>
}
