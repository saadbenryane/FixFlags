'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getActiveAudit,
  clearActiveAudit,
  ACTIVE_AUDIT_EVENT,
  type ActiveAuditSnapshot,
} from '@/lib/audit/active-audit'

export function useActiveAudit() {
  const [active, setActive] = useState<ActiveAuditSnapshot | null>(null)

  useEffect(() => {
    setActive(getActiveAudit())

    function onStorage() {
      setActive(getActiveAudit())
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(ACTIVE_AUDIT_EVENT, onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(ACTIVE_AUDIT_EVENT, onStorage)
    }
  }, [])

  const dismiss = useCallback((auditId?: string) => {
    clearActiveAudit(auditId)
    setActive(getActiveAudit())
  }, [])

  const refresh = useCallback(() => setActive(getActiveAudit()), [])
  return { active, dismiss, refresh }
}
