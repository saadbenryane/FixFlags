import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { z } from 'zod'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { API_KEY_CLIENTS, type ApiKeyClient } from '@/lib/mcp/builders'
import { API_KEY_COPY } from '@/lib/marketing/copy/terminology'
import { ACCOUNT_CHANGED_CODE, ACCOUNT_OWNER_HEADER } from '@/lib/api/account-response'
import type { DeveloperKeyExpiryDays, DeveloperKeyScopePreset } from '@/lib/mcp/developer-key-policy'

const keyFields = z.object({ id: z.string().min(1), name: z.string(), prefix: z.string().min(1),
  lastFour: z.string().length(4), client: z.string().nullable(), scopes: z.array(z.string()), expiresAt: z.string().datetime().nullable() })
const summarySchema = keyFields.extend({ lastUsed: z.string().datetime().nullable(), createdAt: z.string().datetime() })
const listSchema = z.array(summarySchema).refine(keys => new Set(keys.map(key => key.id)).size === keys.length)
const createdSchema = keyFields.extend({ key: z.string().regex(/^ff_live_[a-f0-9]{64}$/),
  client: z.enum(API_KEY_CLIENTS).nullable(), expiresAt: z.string().datetime() })
  .refine(key => key.key.startsWith(key.prefix) && key.key.endsWith(key.lastFour))
export type ApiKeySummary = z.infer<typeof summarySchema>
export type CreatedApiKey = z.infer<typeof createdSchema>

/** An interrupted creation may have committed, but its secret cannot be recovered. */
export class ApiKeyCreationUnconfirmed extends Error {
  constructor() { super(API_KEY_COPY.createUnconfirmed) }
}
export class ApiKeyAccessError extends Error {
  constructor(readonly reason: 'signed_out' | 'account_changed') {
    super(reason === 'signed_out' ? API_KEY_COPY.accountUnavailable : API_KEY_COPY.accountChanged)
  }
}
const accountHeaders = (ownerId?: string) => ownerId ? { [ACCOUNT_OWNER_HEADER]: ownerId } : undefined
function verifyAccount(response: Response, body: unknown, ownerId?: string) {
  if (response.status === 401) throw new ApiKeyAccessError('signed_out')
  if (body && typeof body === 'object' && 'code' in body && body.code === ACCOUNT_CHANGED_CODE ||
    ownerId && response.ok && response.headers.get(ACCOUNT_OWNER_HEADER) !== ownerId) throw new ApiKeyAccessError('account_changed')
}

export async function listApiKeys(signal?: AbortSignal, ownerId?: string): Promise<ApiKeySummary[]> {
  try {
    const { response, body } = await fetchJsonWithDeadline('/api/api-keys', { cache: 'no-store', signal, headers: accountHeaders(ownerId) }, 15_000)
    verifyAccount(response, body, ownerId)
    if (!response.ok) throw new Error(API_KEY_COPY.listFailed)
    return listSchema.parse(body)
  } catch (error) { if (error instanceof ApiKeyAccessError) throw error; throw new Error(API_KEY_COPY.listFailed) }
}

export async function revokeApiKey(id: string, signal?: AbortSignal, ownerId?: string): Promise<void> {
  try {
    const { response, body } = await fetchJsonWithDeadline(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE', signal, headers: accountHeaders(ownerId) })
    verifyAccount(response, body, ownerId)
    if (!response.ok || !z.object({ ok: z.literal(true) }).safeParse(body).success) throw new Error(API_KEY_COPY.revokeFailed)
  } catch (error) { if (error instanceof ApiKeyAccessError) throw error; throw new Error(API_KEY_COPY.revokeFailed) }
}

export async function createApiKey(input: {
  name?: string
  client?: ApiKeyClient
  scopePreset?: DeveloperKeyScopePreset
  expiresInDays?: DeveloperKeyExpiryDays
} = {}, signal?: AbortSignal, ownerId?: string): Promise<CreatedApiKey> {
  let result: Awaited<ReturnType<typeof fetchJsonWithDeadline>>
  try { result = await fetchJsonWithDeadline('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...accountHeaders(ownerId) },
    body: JSON.stringify(input),
    signal,
  }) } catch { throw new ApiKeyCreationUnconfirmed() }
  const { response, body } = result
  verifyAccount(response, body, ownerId)
  if (!response.ok) {
    throw new Error((await parseApiErrorResponse(response, body)).message)
  }
  const parsed = createdSchema.safeParse(body)
  if (!parsed.success) throw new ApiKeyCreationUnconfirmed()
  return parsed.data
}
