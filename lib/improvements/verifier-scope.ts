import { baseCheckId } from '@/lib/audit/check-identity'

/** Pure target and URL identity shared by collection and durable verification. */
export function verifierTargetKey(input: { source: string; checkId: string | null; fingerprint?: string | null }): string | null {
  const checkId = baseCheckId(input.checkId)
  if (checkId) return `check:${checkId}`
  if (input.source === 'AI' && input.fingerprint?.trim()) return `ai:${input.fingerprint.trim()}`
  return null
}

export function normalizeVerifierUrl(value: string): string {
  try {
    const url = new URL(value)
    const serialized = url.toString()
    // Preserve the established root key without changing path or query identity.
    return url.pathname === '/' && !url.search && !url.hash && serialized.endsWith('/')
      ? serialized.slice(0, -1) : serialized
  } catch { return value }
}

/** Historical rows can omit the page column. A recorded page must agree with its evidence. */
export function matchesRecordedVerifierPage(recordedPage: string | null | undefined, evidencePage: string): boolean {
  return recordedPage == null || normalizeVerifierUrl(recordedPage) === normalizeVerifierUrl(evidencePage)
}

/** A retained receipt can omit the task link. An explicit link binds its evidence. */
export function matchesRecordedVerifierTask(recordedTaskId: string | null | undefined, evidenceTaskId: string): boolean {
  return recordedTaskId == null || recordedTaskId === evidenceTaskId
}

export function verifierScopeKey(pageUrl: string | null): string {
  return pageUrl ? `page:${normalizeVerifierUrl(pageUrl)}` : 'product'
}
