'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ChevronDown, Radio } from 'lucide-react'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import styles from './SiteMonitoringMenu.module.css'

export function SiteMonitoringMenu({ label, state, nextCheck, onManage, manageHref, manageLabel = C.edit }: {
  label: string
  state: 'healthy' | 'attention' | 'unknown'
  nextCheck: string | (() => string)
  onManage?: () => void
  manageHref?: Route
  manageLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; width: number; top?: number }>()
  const id = useId()
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      if (!root.current || !panel.current) return
      const anchor = root.current.getBoundingClientRect()
      const content = root.current.closest('[data-site-content]')?.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const leftEdge = Math.max(16, content?.width ? content.left + 8 : 16)
      const rightEdge = Math.min(viewportWidth - 16, content?.width ? content.right - 8 : viewportWidth - 16)
      const width = Math.min(240, Math.max(0, rightEdge - leftEdge))
      const left = Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width)) - anchor.left
      const height = panel.current.getBoundingClientRect().height
      const top = anchor.bottom + 8 + height > viewportHeight - 16 && anchor.top >= height + 24 ? -height - 8 : undefined
      setPosition(previous => previous?.left === left && previous?.width === width && previous?.top === top ? previous : { left, width, top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
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
      <p>{typeof nextCheck === 'function' ? nextCheck() : nextCheck}</p>
      {onManage ? <InteractiveButton type="button" className={styles.manage} onClick={() => { setOpen(false); onManage() }}>{C.edit}</InteractiveButton>
        : manageHref ? <Link className={styles.manage} href={manageHref} onClick={() => setOpen(false)}>{manageLabel}</Link> : null}
    </div> : null}
  </div>
}
