'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const PANEL_STORAGE_KEY = 'ff_support_panel_open'

export interface OpenSupportChatOptions {
  pageUrl?: string
  auditId?: string | null
  prefill?: string
}

interface SupportContextValue {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  auditId: string | null
  setAuditIdOverride: (id: string | null) => void
  draftPrefill: string | null
  clearDraftPrefill: () => void
  openSupportChat: (options?: OpenSupportChatOptions) => void
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
  const [auditIdOverride, setAuditIdOverride] = useState<string | null>(null)
  const [draftPrefill, setDraftPrefill] = useState<string | null>(null)
  const openRequestRef = useRef(0)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PANEL_STORAGE_KEY)
      if (stored === '1') setPanelOpenState(true)
    } catch {
      // ignore storage errors
    }
    setHydrated(true)
  }, [])

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open)
    try {
      sessionStorage.setItem(PANEL_STORAGE_KEY, open ? '1' : '0')
    } catch {
      // ignore storage errors
    }
  }, [])

  const clearDraftPrefill = useCallback(() => setDraftPrefill(null), [])

  const openSupportChat = useCallback(
    (options?: OpenSupportChatOptions) => {
      openRequestRef.current += 1
      if (options?.auditId) setAuditIdOverride(options.auditId)
      if (options?.prefill) setDraftPrefill(options.prefill)
      setPanelOpen(true)
    },
    [setPanelOpen]
  )

  const resolvedAuditId = auditIdOverride ?? auditId

  const value = useMemo(
    () => ({
      panelOpen: hydrated && panelOpen,
      setPanelOpen,
      sessionId,
      setSessionId,
      auditId: resolvedAuditId,
      setAuditIdOverride,
      draftPrefill,
      clearDraftPrefill,
      openSupportChat,
    }),
    [
      hydrated,
      panelOpen,
      setPanelOpen,
      sessionId,
      resolvedAuditId,
      draftPrefill,
      clearDraftPrefill,
      openSupportChat,
    ]
  )

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}

export function useSupportContext() {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupportContext must be used within SupportProvider')
  return ctx
}

/** Safe hook when SupportProvider may be absent (e.g. admin). */
export function useOptionalSupportContext() {
  return useContext(SupportContext)
}
