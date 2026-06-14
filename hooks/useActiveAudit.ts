'use client'

import { useEffect, useState } from 'react'
import {
  getActiveAudit,
  clearActiveAudit,
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
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function dismiss(auditId?: string) {
    clearActiveAudit(auditId)
    setActive(getActiveAudit())
  }

  return { active, dismiss, refresh: () => setActive(getActiveAudit()) }
}
