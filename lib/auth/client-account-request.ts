import { z } from 'zod'
import { withClientDeadline } from '@/lib/api/client-request'

export type AccountClientRequest = (signal: AbortSignal) => Promise<{ data?: unknown; error?: { message?: string } | null }>
export const accountStatusReceipt = z.object({ status: z.literal(true) })

/** An SDK response must confirm the specific operation before the UI retires its draft. */
export async function requestAccountChange<T>(operation: AccountClientRequest, receipt: z.ZodType<T>, fallback: string, parent?: AbortSignal): Promise<
  { ok: true; data: T } | { ok: false; error: string }
> {
  try {
    const result = await withClientDeadline(operation, parent)
    if (result.error) return { ok: false, error: typeof result.error.message === 'string' && result.error.message.trim() ? result.error.message : fallback }
    const parsed = receipt.safeParse(result.data)
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: fallback }
  } catch { return { ok: false, error: fallback } }
}
