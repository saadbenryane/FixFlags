'use client'

import { ChevronDown, Check, Copy } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import styles from './FixPromptCard.module.css'

export function FixPromptCard({ prompt, onCopy, copied = false, busy = false, disabled = false, copyLabel = C.fixAll, onExpand, unavailable }: {
  prompt?: string | null; onCopy: () => void; copied?: boolean; busy?: boolean; disabled?: boolean; copyLabel?: string; onExpand?: () => void; unavailable?: string | null;
}) {
  return <section className={styles.card} aria-label={C.promptTitle}>
    <div className={styles.header}><span className={styles.title}><Logo variant="mark" size="sm" /><strong>{C.promptTitle}</strong></span><Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={onCopy}>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? C.bundleCopied : copyLabel}</Button></div>
    <details className={styles.preview} onToggle={event => { if (event.currentTarget.open) onExpand?.() }}>
      <summary aria-label={C.promptPreview}><span>{(prompt || unavailable || (busy ? C.promptLoading : C.bundleBody)).replace(/\n{2,}/g, '\n')}</span><ChevronDown size={15} aria-hidden /></summary>
      {prompt ? <Textarea readOnly rows={10} value={prompt} aria-label={SITE_BOARD_COPY.fixPromptLabel} className="font-mono text-xs leading-relaxed" /> : <p role={unavailable ? 'alert' : 'status'}>{unavailable || C.promptLoading}</p>}
    </details>
  </section>
}
