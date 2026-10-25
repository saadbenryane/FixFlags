'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'
import type { ReportClaimReason } from '@/lib/audit/access-context'
import { parseSiteContinuation, SITE_CONTINUATION_PREFIX, siteNavigationRoot } from '@/lib/sites/navigation-continuity'

type OpenOptions = {
  reason?: ReportClaimReason
  nextPath?: string
  auditId?: string
  trigger?: HTMLElement
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
  const opener = useRef<HTMLElement | null>(null)

  const reportIdFromPath = /^\/report\/([^/]+)/.exec(pathname)?.[1]
  const resolvedAuditId = dialogAuditId ?? auditId ?? reportIdFromPath

  const openGate = useCallback((options?: OpenOptions) => {
    opener.current = options?.trigger ?? document.activeElement as HTMLElement
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
        onOpenChange={value => {
          if (!value) {
            const current = new URL(window.location.href), root = siteNavigationRoot(current.pathname)
            if (root) {
              const key = SITE_CONTINUATION_PREFIX + root
              try { if (parseSiteContinuation(sessionStorage.getItem(key), current, Date.now())) sessionStorage.removeItem(key) } catch { /* Navigation still works without browser-local storage. */ }
            }
          }
          setOpen(value)
        }}
        restoreFocus={() => { if (opener.current?.isConnected) opener.current.focus() }}
        nextPath={nextPath}
        from="report"
        auditId={resolvedAuditId}
        reason={reason}
      />
    </ReportAuthGateContext.Provider>
  )
}
