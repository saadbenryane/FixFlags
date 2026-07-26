import type { QueueStatus } from '@/lib/queue/estimate'

const STORAGE_KEY = 'ff:active-check'
export const ACTIVE_AUDIT_EVENT = 'fixflags:active-audit-change'

function notifyActiveAuditChange(): void {
  window.dispatchEvent(new Event(ACTIVE_AUDIT_EVENT))
}

export interface ActiveAuditSnapshot {
  auditId: string
  url: string
  queue?: QueueStatus
}

export function setActiveAudit(
  snapshot: ActiveAuditSnapshot,
  options?: { notify?: boolean }
): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  sessionStorage.removeItem(STORAGE_KEY)
  if (options?.notify !== false) notifyActiveAuditChange()
}

export function getActiveAudit(): ActiveAuditSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
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
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  notifyActiveAuditChange()
}

export function auditHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
