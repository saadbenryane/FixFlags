'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'

/** Explicit continuation keeps its reading position after new content commits. */
export function useContinuationFocus(scope: string, busy = false) {
  const root = useRef<HTMLElement>(null)
  const owner = useMemo(() => ({ scope }), [scope])
  const pending = useRef<{ owner: object; button: HTMLButtonElement; before: Set<Element>; dialog: Element | null } | null>(null)
  useLayoutEffect(() => () => {
    if (pending.current?.owner === owner) pending.current = null
  }, [owner])
  useLayoutEffect(() => {
    const request = pending.current
    if (!request || busy) return
    pending.current = null
    if (request.owner !== owner || !root.current) return
    const active = document.activeElement
    if (active !== request.button && active !== document.body && active !== request.dialog) return
    const added = [...root.current.querySelectorAll<HTMLElement>('[data-continuation-item]')]
      .find(element => !request.before.has(element))
    const fallback = request.button.isConnected ? request.button
      : root.current.querySelector<HTMLElement>('[data-continuation-control]') ?? root.current
    const target = added ?? fallback
    target.focus()
  })
  function begin(button: HTMLButtonElement) {
    pending.current = document.activeElement === button && root.current ? {
      owner, button, before: new Set(root.current.querySelectorAll('[data-continuation-item]')),
      dialog: button.closest('[role="dialog"]'),
    } : null
  }
  return { root, begin }
}
