'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { AUTH } from '@/lib/marketing/copy/auth'

type Guard = { ask: () => Promise<boolean>; discard: () => void; navigate: (href: string) => void }
const guards = new Map<symbol, Guard>()
let decision: symbol | null = null

function onClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
  const next = new URL(anchor.href, window.location.href)
  if (!['http:', 'https:'].includes(next.protocol) || next.origin === window.location.origin &&
      next.pathname === window.location.pathname && next.search === window.location.search) return
  const first = guards.entries().next().value
  if (!first) return
  event.preventDefault(); event.stopPropagation()
  if (decision) return
  const [id, guard] = first
  const pending = [...guards.values()]
  decision = id
  void guard.ask().then(leave => {
    if (decision === id && leave) {
      for (const item of pending) item.discard()
      guard.navigate(next.href)
    }
  }).finally(() => { if (decision === id) decision = null })
}

/** Multiple forms on Settings share one navigation decision, so accepting a
 * profile warning cannot bypass another form's unsaved email preferences. */
export function useUnsavedChanges(dirty: boolean, discard: () => void) {
  const { push } = useRouter(), { confirm, confirmDialog } = useConfirm()
  useEffect(() => {
    if (!dirty) return
    const id = Symbol('unsaved-settings'), copy = AUTH.settings.account
    guards.set(id, { ask: () => confirm({ title: copy.unsavedTitle, description: copy.unsavedDescription,
      confirmLabel: copy.unsavedLeave, cancelLabel: copy.unsavedStay }),
    discard, navigate: href => {
      const next = new URL(href)
      if (next.origin === window.location.origin) push(`${next.pathname}${next.search}${next.hash}` as Route)
      else window.location.assign(next.href)
    } })
    if (guards.size === 1) document.addEventListener('click', onClick, true)
    return () => {
      guards.delete(id)
      if (decision === id) decision = null
      if (!guards.size) document.removeEventListener('click', onClick, true)
    }
  }, [dirty, confirm, push, discard])
  return confirmDialog
}
