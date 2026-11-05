import { z } from 'zod'

const receipt = z.object({
  version: z.literal(1), selection: z.string(), flagId: z.string().min(1),
  key: z.string().regex(/^web:[0-9a-f-]{36}$/i), changeSummary: z.string().max(2000),
})
export type VerificationIntent = z.infer<typeof receipt>
const pending = new Map<string, VerificationIntent | null>()
const storageKey = (selection: string) => `fixflags:verification:${selection}`

/** The submitted declaration and its retry key have one browser-tab lifetime.
 * This is retry state only. The server still authorizes and records every check. */
export function readVerificationIntent(selection: string, flagId: string): VerificationIntent | null {
  if (typeof window === 'undefined') return null
  if (pending.has(selection)) {
    const remembered = pending.get(selection)
    return remembered?.flagId === flagId ? remembered : null
  }
  try {
    const raw = sessionStorage.getItem(storageKey(selection))
    if (!raw) return null
    const parsed = receipt.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.selection !== selection || parsed.data.flagId !== flagId) return null
    pending.set(selection, parsed.data)
    return parsed.data
  } catch { return null }
}

export function startVerificationIntent(selection: string, flagId: string, changeSummary: string): VerificationIntent {
  const remembered = readVerificationIntent(selection, flagId)
  if (remembered) return remembered
  const intent: VerificationIntent = { version: 1, selection, flagId,
    key: `web:${crypto.randomUUID()}`, changeSummary: changeSummary.trim().slice(0, 2000) }
  if (typeof window !== 'undefined') {
    pending.set(selection, intent)
    try { sessionStorage.setItem(storageKey(selection), JSON.stringify(intent)) } catch { /* Keep retry state in this tab when storage is unavailable. */ }
  }
  return intent
}

export function completeVerificationIntent(selection: string, submitted: VerificationIntent) {
  if (readVerificationIntent(selection, submitted.flagId)?.key !== submitted.key) return
  pending.set(selection, null)
  try { sessionStorage.removeItem(storageKey(selection)) } catch { /* The confirmed response already retired the in-memory retry. */ }
}
