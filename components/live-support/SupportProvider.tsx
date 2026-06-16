'use client'

import { createContext, useContext, useMemo, useState } from 'react'

interface SupportContextValue {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
}

const SupportContext = createContext<SupportContextValue | null>(null)

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const value = useMemo(
    () => ({ panelOpen, setPanelOpen, sessionId, setSessionId }),
    [panelOpen, sessionId]
  )

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}

export function useSupportContext() {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupportContext must be used within SupportProvider')
  return ctx
}
