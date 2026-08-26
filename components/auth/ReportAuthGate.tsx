'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'
import type { ReportClaimReason } from '@/lib/audit/access-context'

type OpenOptions = {
  reason?: ReportClaimReason
  nextPath?: string
  auditId?: string
}

type ReportAuthGateValue = {
  open: (options?: OpenOptions) => void
}

const ReportAuthGateContext = createContext<ReportAuthGateValue | null>(null)

export function useReportAuthGate() {
  return useContext(ReportAuthGateContext)
}

export function ReportAuthGateProvider({
  children,
  auditId,
  defaultReason = 'create-account',
}: {
  children: React.ReactNode
  auditId?: string
  defaultReason?: ReportClaimReason
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportClaimReason>(defaultReason)
  const [nextPath, setNextPath] = useState<string | undefined>()
  const [dialogAuditId, setDialogAuditId] = useState<string | undefined>(auditId)

  const reportIdFromPath = /^\/report\/([^/]+)/.exec(pathname)?.[1]
  const resolvedAuditId = dialogAuditId ?? auditId ?? reportIdFromPath

  const openGate = useCallback((options?: OpenOptions) => {
    setReason(options?.reason ?? defaultReason)
    setNextPath(options?.nextPath ?? (pathname.startsWith('/report/') ? pathname : undefined))
    setDialogAuditId(options?.auditId ?? auditId ?? reportIdFromPath)
    setOpen(true)
  }, [auditId, defaultReason, pathname, reportIdFromPath])

  const value = useMemo(() => ({ open: openGate }), [openGate])

  return (
    <ReportAuthGateContext.Provider value={value}>
      {children}
      <ReportClaimDialog
        open={open}
        onOpenChange={setOpen}
        nextPath={nextPath}
        from="report"
        auditId={resolvedAuditId}
        reason={reason}
      />
    </ReportAuthGateContext.Provider>
  )
}
