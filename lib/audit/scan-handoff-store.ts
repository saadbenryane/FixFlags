'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type ScanHandoffLimitGate = {
  message: string
  code?: string
  action?: string
  nextPath?: string
  from?: string
}

export type ScanHandoffState = {
  url: string | null
  limitGate: ScanHandoffLimitGate | null
}

type Listener = () => void

let state: ScanHandoffState = { url: null, limitGate: null }
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ScanHandoffState {
  return state
}

function getServerSnapshot(): ScanHandoffState {
  return { url: null, limitGate: null }
}

/** Open progressive chrome immediately while a create/re-check request runs. */
export function openScanHandoff(url: string): void {
  state = { url, limitGate: null }
  emit()
}

/** Morph handoff into a limit/auth gate without flashing the underlying form. */
export function setScanHandoffLimitGate(gate: ScanHandoffLimitGate): void {
  const fromNext = gate.nextPath ? extractUrlFromNext(gate.nextPath) : null
  state = {
    url: state.url ?? fromNext,
    limitGate: gate,
  }
  emit()
}

export function closeScanHandoff(): void {
  state = { url: null, limitGate: null }
  emit()
}

function extractUrlFromNext(nextPath: string): string | null {
  try {
    const q = nextPath.includes('?') ? nextPath.slice(nextPath.indexOf('?') + 1) : ''
    const url = new URLSearchParams(q).get('url')
    return url
  } catch {
    return null
  }
}

export function useScanHandoffState(): ScanHandoffState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useScanHandoffControls() {
  return {
    open: useCallback((url: string) => openScanHandoff(url), []),
    setLimitGate: useCallback((gate: ScanHandoffLimitGate) => setScanHandoffLimitGate(gate), []),
    close: useCallback(() => closeScanHandoff(), []),
  }
}
