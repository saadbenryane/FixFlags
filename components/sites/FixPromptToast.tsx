'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import styles from './FixPromptToast.module.css'

export function showFixPromptCopied() {
  const copiedAt = Date.now()
  toast.custom(id => <div key={copiedAt} className={styles.confirmation} role="status">
    <Check size={18} aria-hidden="true" />
    <div><strong>{SITE_BOARD_COPY.copyPromptCopied}</strong><Link href="/docs/fix-with-ai">{SITE_BOARD_COPY.useFixPrompt}</Link></div>
    <InteractiveButton type="button" aria-label="Dismiss confirmation" onClick={() => toast.dismiss(id)}><X size={16} aria-hidden="true" /></InteractiveButton>
    <span className={styles.countdown} aria-hidden="true" />
  </div>, { id: 'fix-prompt-copied', position: 'bottom-center', duration: 5000 })
}
