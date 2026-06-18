'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const PANEL_STORAGE_KEY = 'ff_support_panel_open'

interface SupportContextValue {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  auditId: string | null
}

const SupportContext = createContext<SupportContextValue | null>(null)

export function SupportProvider({
  children,
  auditId = null,
}: {
  children: React.ReactNode
  auditId?: string | null
}) {
  const [panelOpen, setPanelOpenState] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PANEL_STORAGE_KEY)
      if (stored === '1') setPanelOpenState(true)
    } catch {
      // ignore storage errors
    }
    setHydrated(true)
  }, [])

  const setPanelOpen = (open: boolean) => {
    setPanelOpenState(open)
    try {
      sessionStorage.setItem(PANEL_STORAGE_KEY, open ? '1' : '0')
    } catch {
      // ignore storage errors
    }
  }

  const value = useMemo(
    () => ({ panelOpen: hydrated && panelOpen, setPanelOpen, sessionId, setSessionId, auditId }),
    [hydrated, panelOpen, sessionId, auditId]
  )

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}

export function useSupportContext() {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupportContext must be used within SupportProvider')
  return ctx
}
