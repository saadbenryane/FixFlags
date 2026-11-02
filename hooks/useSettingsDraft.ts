'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { activateSettingsDrafts, confirmSettingsDraft, readSettingsDraft, subscribeSettingsBaseline, writeSettingsDraft, type SettingsValues } from '@/lib/settings/drafts'

type Snapshot<T> = { values: T; discardVersion: number; generation: number }

/** Retain non-secret edits across route unmounts, including Back and router
 * navigation. Server updates replace clean fields without erasing edited ones. */
export function useSettingsDraft<T extends SettingsValues>(ownerId: string, form: string, initial: T) {
  const { refresh } = useRouter()
  const [state, setState] = useState(() => ({ saved: initial, values: readSettingsDraft(ownerId, form, initial) }))
  const current = useRef(state)
  const lifecycle = useRef({ generation: -1, discardVersion: 0, mounted: false })
  const initialKey = JSON.stringify(initial)
  const publish = useCallback((next: typeof state) => {
    if (!lifecycle.current.mounted || !writeSettingsDraft(ownerId, lifecycle.current.generation, form, next.saved, next.values)) return
    current.current = next
    setState(next)
  }, [ownerId, form])
  useEffect(() => {
    const active = lifecycle.current
    active.generation = activateSettingsDrafts(ownerId)
    active.mounted = true
    const unsubscribe = subscribeSettingsBaseline(ownerId, active.generation, refresh)
    return () => { active.mounted = false; unsubscribe() }
  }, [ownerId, refresh])
  useEffect(() => {
    const saved = JSON.parse(initialKey) as T
    // Reconcile retained edits against the authoritative baseline too. A save
    // confirmed after navigation must retire its patch and unload warning.
    publish({ saved, values: readSettingsDraft(ownerId, form, saved) })
  }, [ownerId, form, initialKey, publish])

  const change = useCallback((patch: Partial<T>) => {
    publish({ ...current.current, values: { ...current.current.values, ...patch } })
  }, [publish])
  const discard = useCallback(() => {
    lifecycle.current.discardVersion++
    publish({ saved: current.current.saved, values: current.current.saved })
  }, [publish])
  const snapshot = useCallback((): Snapshot<T> => ({ values: { ...current.current.values }, discardVersion: lifecycle.current.discardVersion,
    generation: lifecycle.current.generation }), [])
  const acknowledge = useCallback((submitted: Snapshot<T>, confirmed: Partial<T>) => {
    if (submitted.generation !== lifecycle.current.generation) return
    if (submitted.discardVersion === lifecycle.current.discardVersion) {
      const { saved, values } = current.current
      publish({ saved: { ...saved, ...confirmed }, values: { ...values, ...Object.fromEntries(
        Object.entries(confirmed).filter(([key]) => values[key] === submitted.values[key]),
      ) } })
    }
    confirmSettingsDraft(ownerId, lifecycle.current.generation, form, submitted.values, confirmed)
  }, [ownerId, form, publish])
  return { ...state, change, discard, snapshot, acknowledge,
    dirty: Object.keys(state.values).some(key => state.values[key] !== state.saved[key]) }
}
