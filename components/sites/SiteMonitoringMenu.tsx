'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ChevronDown, Radio } from 'lucide-react'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { useMinuteClock } from '@/hooks/useMinuteClock'
import styles from './SiteMonitoringMenu.module.css'

export function SiteMonitoringMenu({ label, state, nextCheck, onManage, manageHref, manageLabel = C.edit }: {
  label: string
  state: 'healthy' | 'attention' | 'unknown'
  nextCheck: string | ((now: number) => string)
  onManage?: () => void
  manageHref?: Route
  manageLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const now = useMinuteClock(open && typeof nextCheck === 'function')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; width: number; top: number; maxHeight: number }>()
  const id = useId()
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      if (!root.current || !panel.current) return
      const anchor = root.current.getBoundingClientRect()
      const content = root.current.closest('[data-site-content]')?.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportLeft = (viewport?.offsetLeft ?? 0) + 16
      const viewportRight = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? (document.documentElement.clientWidth || window.innerWidth)) - 16
      const viewportTop = (viewport?.offsetTop ?? 0) + 16
      const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 16
      if (anchor.height > 0 && anchor.width > 0 && (anchor.bottom <= viewportTop - 16 || anchor.top >= viewportBottom + 16 ||
        anchor.right <= viewportLeft - 16 || anchor.left >= viewportRight + 16)) {
        if (panel.current.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
        setOpen(false)
        return
      }
      const leftEdge = Math.min(viewportRight, Math.max(viewportLeft, content?.width ? content.left + 8 : viewportLeft))
      const rightEdge = Math.max(leftEdge, Math.min(viewportRight, content?.width ? content.right - 8 : viewportRight))
      const width = Math.min(240, Math.max(0, rightEdge - leftEdge))
      const left = Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width)) - anchor.left
      // Retain full content height when the visible box is already constrained.
      const height = Math.max(panel.current.scrollHeight, panel.current.getBoundingClientRect().height)
      const below = Math.max(0, viewportBottom - anchor.bottom - 8)
      const above = Math.max(0, anchor.top - viewportTop - 8)
      const upward = height > below && above > below
      const maxHeight = upward ? above : below
      const top = upward ? -Math.min(height, maxHeight) - 8 : anchor.height + 8
      setPosition(previous => previous?.left === left && previous?.width === width && previous?.top === top && previous?.maxHeight === maxHeight ? previous : { left, width, top, maxHeight })
    }
    place()
    const observer = new ResizeObserver(place)
    if (root.current) observer.observe(root.current)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, { capture: true, passive: true })
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      viewport?.removeEventListener('resize', place)
      viewport?.removeEventListener('scroll', place)
    }
  }, [open, label, position?.width])
  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return <div ref={root} className={styles.control} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <InteractiveButton ref={trigger} type="button" className={styles.trigger} data-state={state} aria-label={`${C.title}: ${label}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)}>
      <Radio size={15} aria-hidden /><span>{label}</span><ChevronDown size={13} aria-hidden />
    </InteractiveButton>
    {open ? <div ref={panel} id={id} role="region" aria-label={C.title} className={styles.panel} style={position}>
      <strong>{C.title}</strong>
      <p>{typeof nextCheck === 'function' ? nextCheck(now ?? Date.now()) : nextCheck}</p>
      {onManage ? <InteractiveButton type="button" className={styles.manage} onClick={() => { setOpen(false); onManage() }}>{C.edit}</InteractiveButton>
        : manageHref ? <Link className={styles.manage} href={manageHref} onClick={() => setOpen(false)}>{manageLabel}</Link> : null}
    </div> : null}
  </div>
}
