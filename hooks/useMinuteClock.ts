'use client'

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let now: number | null = null
let timer: ReturnType<typeof setInterval> | undefined
const serverSnapshot = () => null
const snapshot = () => now
const idle = () => () => {}

function publish() {
  now = Date.now()
  for (const listener of listeners) listener()
}

function resume() {
  clearInterval(timer)
  timer = undefined
  if (document.visibilityState === 'hidden') return
  publish()
  timer = setInterval(publish, 60_000)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    resume()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    clearInterval(timer)
    timer = undefined
    now = null
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('focus', resume)
  }
}

/** One visible-page display clock. Server rendering retains its supplied time. */
export function useMinuteClock(enabled = true) {
  return useSyncExternalStore(enabled ? subscribe : idle, enabled ? snapshot : serverSnapshot, serverSnapshot)
}
