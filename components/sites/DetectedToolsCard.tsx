'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
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
    <InteractiveButton ref={trigger} type="button" className={styles.trigger} aria-label={C.viewTools} onClick={() => setOpen(true)}>
      <span className={styles.heading}><span>{C.detectedTools}</span><ArrowUpRight size={14} aria-hidden /></span>
      <span className={styles.tools}>{items.map(item => <span key={item.name} title={`${item.name}: ${item.status}`}><ToolLogo name={item.name} /><span>{item.name}</span></span>)}</span>
    </InteractiveButton>
    <ResponsiveDepth header={<DialogTitle>{C.detectedTools}</DialogTitle>} open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DialogDescription>{items.length} {C.tools(items.length)}</DialogDescription>
      <TechnologyStrip items={items} label={null} onSelect={onSelect ? item => { setOpen(false); onSelect(item) } : undefined} />
    </ResponsiveDepth>
  </section>
}
