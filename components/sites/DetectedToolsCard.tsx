'use client'

import { useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from './ResponsiveDepth'
import { TechnologyStrip, ToolLogo, type ToolItem } from './SiteTooling'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'
import styles from './DetectedToolsCard.module.css'

export function DetectedToolsCard({ items, onSelect }: { items: readonly ToolItem[]; onSelect?: (item: ToolItem) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  if (!items.length) return null
  return <section className={styles.card} aria-label="Detected technologies">
    <button ref={trigger} type="button" className={styles.trigger} aria-label={C.viewTools} onClick={() => setOpen(true)}>
      <span className={styles.heading}><strong>{items.length}</strong><span>{C.tools(items.length)}</span><ArrowUpRight size={15} aria-hidden /></span>
      <span className={styles.tools}>{items.slice(0, 4).map(item => <span key={item.name} title={`${item.name}: ${item.status}`}><ToolLogo name={item.name} /><span>{item.name}</span></span>)}</span>
      {items.length > 4 ? <span className={styles.more}>{C.moreTools(items.length - 4)}</span> : null}
    </button>
    <ResponsiveDepth open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DialogTitle>{C.detectedTools}</DialogTitle><DialogDescription>{items.length} {C.tools(items.length)}</DialogDescription>
      <TechnologyStrip items={items} label={null} onSelect={onSelect ? item => { setOpen(false); onSelect(item) } : undefined} />
    </ResponsiveDepth>
  </section>
}
