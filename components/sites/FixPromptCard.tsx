'use client'

import { ChevronDown, Check, Copy } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { cursorPromptDeeplink } from '@/lib/integrations/editor-deeplinks'
import styles from './FixPromptCard.module.css'

export function FixPromptCard({ prompt, onCopy, copied = false, busy = false, disabled = false, copyLabel, copiedLabel, onExpand, unavailable, onDownload, downloadLabel, openInCursor = false }: {
  prompt?: string | null; onCopy: () => void; copied?: boolean; busy?: boolean; disabled?: boolean; copyLabel: string; copiedLabel: string; onExpand?: () => void; unavailable?: string | null;
  onDownload?: () => void; downloadLabel?: string; openInCursor?: boolean;
}) {
  const cursorLink = openInCursor && prompt ? cursorPromptDeeplink(prompt) : null
  return <section className={styles.card} aria-label={C.promptTitle}>
    <div className={styles.header}><span className={styles.title}><Logo variant="mark" size="sm" /><strong>{C.promptTitle}</strong></span><Button type="button" size="sm" disabled={busy || disabled} loading={busy && !copied} loadingLabel={copyLabel} aria-busy={busy || undefined} onClick={onCopy}>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? copiedLabel : copyLabel}</Button></div>
    <details className={styles.preview} onToggle={event => { if (event.currentTarget.open) onExpand?.() }}>
      <summary aria-label={C.promptPreview}><span>{unavailable || (busy ? C.promptLoading : C.promptPreview)}</span><ChevronDown size={15} aria-hidden /></summary>
      {prompt ? <Textarea readOnly rows={10} value={prompt} aria-label={SITE_BOARD_COPY.fixPromptLabel} className="font-mono text-xs leading-relaxed" /> : <p role={unavailable ? 'alert' : 'status'}>{unavailable || C.promptLoading}</p>}
      {cursorLink ? <p className={styles.handoff}><a href={cursorLink}>{C.openInCursor}</a><span>{C.openInCursorNote}</span></p> : null}
      {prompt && onDownload ? <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={onDownload}>{downloadLabel}</Button> : null}
    </details>
  </section>
}
