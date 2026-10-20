'use client'

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
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

type SupportState = Pick<SupportContextValue, 'panelOpen' | 'sessionId' | 'auditId' | 'draftPrefill'>

function rememberPanel(open: boolean) {
  try { sessionStorage.setItem(PANEL_STORAGE_KEY, open ? '1' : '0') } catch { /* Keep the current tab usable. */ }
}

function createSupportStore(baseAuditId: string | null) {
  let override: string | null = null
  let state: SupportState = { panelOpen: false, sessionId: null, auditId: baseAuditId, draftPrefill: null }
  const listeners = new Set<() => void>()
  let snapshot: SupportContextValue
  function update(patch: Partial<SupportState>) {
    if ((Object.keys(patch) as (keyof SupportState)[]).every(key => Object.is(state[key], patch[key]))) return
    state = { ...state, ...patch }
    snapshot = { ...state, ...actions }
    for (const listener of listeners) listener()
  }
  const actions = {
    setPanelOpen(open: boolean) { update({ panelOpen: open }); rememberPanel(open) },
    setSessionId(id: string | null) { update({ sessionId: id }) },
    setAuditIdOverride(id: string | null) { override = id; update({ auditId: override ?? baseAuditId }) },
    clearDraftPrefill() { update({ draftPrefill: null }) },
    openSupportChat(options?: OpenSupportChatOptions) {
      if (options?.auditId) override = options.auditId
      update({ panelOpen: true, auditId: override ?? baseAuditId,
        ...(options?.prefill ? { draftPrefill: options.prefill } : {}) })
      rememberPanel(true)
    },
  }
  snapshot = { ...state, ...actions }
  const serverSnapshot = snapshot
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setBaseAuditId(id: string | null) { baseAuditId = id; update({ auditId: override ?? baseAuditId }) },
    restorePanel() {
      try { if (sessionStorage.getItem(PANEL_STORAGE_KEY) === '1') actions.setPanelOpen(true) } catch { /* Keep the initial closed state. */ }
    },
  }
}

const SupportContext = createContext<ReturnType<typeof createSupportStore> | null>(null)
const noSupport = () => null
const noSubscription = () => () => {}

export function SupportProvider({
  children,
  auditId = null,
}: {
  children: React.ReactNode
  auditId?: string | null
}) {
  // Keep the context stable so chat updates reach consumers without disturbing
  // server-rendered content whose client modules have not hydrated yet.
  const [store] = useState(() => createSupportStore(auditId))
  useLayoutEffect(() => { store.setBaseAuditId(auditId) }, [auditId, store])
  useEffect(() => { store.restorePanel() }, [store])
  return <SupportContext.Provider value={store}>{children}</SupportContext.Provider>
}

export function useSupportContext() {
  const ctx = useOptionalSupportContext()
  if (!ctx) throw new Error('useSupportContext must be used within SupportProvider')
  return ctx
}

/** Safe hook when SupportProvider may be absent (e.g. admin). */
export function useOptionalSupportContext() {
  const store = useContext(SupportContext)
  return useSyncExternalStore(store?.subscribe ?? noSubscription,
    store?.getSnapshot ?? noSupport, store?.getServerSnapshot ?? noSupport)
}
