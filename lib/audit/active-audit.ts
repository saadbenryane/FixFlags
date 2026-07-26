const STORAGE_KEY = 'ff:active-check'

export interface ActiveAuditSnapshot {
  auditId: string
  url: string
  estimatedWaitSeconds?: number
  queuePosition?: number
}

export function setActiveAudit(snapshot: ActiveAuditSnapshot): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function getActiveAudit(): ActiveAuditSnapshot | null {
  if (typeof window === 'undefined') return null
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
