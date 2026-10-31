'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { activateSettingsDrafts, readSettingsDraft, writeSettingsDraft, type SettingsValues } from '@/lib/settings/drafts'

type Snapshot<T> = { values: T; discardVersion: number }

/** Retain non-secret edits across route unmounts, including Back and router
 * navigation. Server updates replace clean fields without erasing edited ones. */
export function useSettingsDraft<T extends SettingsValues>(ownerId: string, form: string, initial: T) {
  const [state, setState] = useState(() => ({ saved: initial, values: readSettingsDraft(ownerId, form, initial) }))
  const current = useRef(state)
  const lifecycle = useRef({ generation: -1, discardVersion: 0, mounted: false })
  const initialKey = JSON.stringify(initial)
  useEffect(() => {
    const lifetime = lifecycle.current
    lifetime.generation = activateSettingsDrafts(ownerId)
    lifetime.mounted = true
    return () => { lifetime.mounted = false }
  }, [ownerId])
  useEffect(() => {
    const saved = JSON.parse(initialKey) as T
    const next = { saved, values: readSettingsDraft(ownerId, form, saved) }
    current.current = next
    setState(next)
  }, [ownerId, form, initialKey])

  const publish = useCallback((next: typeof state) => {
    if (!lifecycle.current.mounted || !writeSettingsDraft(ownerId, lifecycle.current.generation, form, next.saved, next.values)) return
    current.current = next
    setState(next)
  }, [ownerId, form])
  const change = useCallback((patch: Partial<T>) => {
    publish({ ...current.current, values: { ...current.current.values, ...patch } })
  }, [publish])
  const discard = useCallback(() => {
    lifecycle.current.discardVersion++
    publish({ saved: current.current.saved, values: current.current.saved })
  }, [publish])
  const snapshot = useCallback((): Snapshot<T> => ({ values: { ...current.current.values }, discardVersion: lifecycle.current.discardVersion }), [])
  const acknowledge = useCallback((submitted: Snapshot<T>, confirmed: Partial<T>) => {
    if (submitted.discardVersion !== lifecycle.current.discardVersion) return
    const { saved, values } = current.current
    publish({ saved: { ...saved, ...confirmed }, values: { ...values, ...Object.fromEntries(
      Object.entries(confirmed).filter(([key]) => values[key] === submitted.values[key]),
    ) } })
  }, [publish])
  return { ...state, change, discard, snapshot, acknowledge,
    dirty: Object.keys(state.values).some(key => state.values[key] !== state.saved[key]) }
}
