const STORAGE_KEY = 'ff:active-check'
const LEGACY_STORAGE_KEY = 'qos:active-audit'

export interface ActiveAuditSnapshot {
  auditId: string
  url: string
  queuePosition?: number
  estimatedWaitSeconds?: number
  scheduledStartAt?: string | null
  queueReason?: 'rate_limit' | 'backlog'
}

function migrateLegacyStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy && !sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, legacy)
    }
    sessionStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function setActiveAudit(snapshot: ActiveAuditSnapshot): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function getActiveAudit(): ActiveAuditSnapshot | null {
  if (typeof window === 'undefined') return null
  migrateLegacyStorage()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActiveAuditSnapshot
  } catch {
    return null
  }
}

export function clearActiveAudit(auditId?: string): void {
  if (typeof window === 'undefined') return
  if (auditId) {
    const current = getActiveAudit()
    if (current?.auditId !== auditId) return
  }
  sessionStorage.removeItem(STORAGE_KEY)
}

export function auditHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
