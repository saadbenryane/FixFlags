'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { trackEvent, type ReportAccessState, type ReportSurface } from '@/lib/analytics/events'
import { isUsableFixPrompt } from '@/lib/audit/priority-flags'

export type CopyKind = 'flag' | 'plan' | 'export' | 'command' | 'link'

export interface CopyOptions {
  kind?: CopyKind
  auditId?: string
  tool?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  successMessage?: string
  successDescription?: string
  /** Gated fix prompts: require a usable prompt and surface a signup toast instead of copying. */
  requireUsablePrompt?: boolean
}

const TRACKED_KINDS = ['flag', 'plan', 'export'] as const
type TrackedKind = (typeof TRACKED_KINDS)[number]

function isTrackedKind(kind: CopyKind): kind is TrackedKind {
  return (TRACKED_KINDS as readonly string[]).includes(kind)
}

/**
 * Single copy surface for the report. Encapsulates the clipboard write,
 * success/error toast, and analytics tracking so the seven bespoke copy
 * handlers across the report converge on one behavior.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string, opts: CopyOptions = {}): Promise<boolean> => {
    const {
      kind = 'command',
      auditId,
      tool,
      surface,
      accessState,
      itemPosition,
      successMessage = 'Copied to clipboard',
      successDescription,
      requireUsablePrompt = false,
    } = opts

    if (requireUsablePrompt && !isUsableFixPrompt(text)) {
      toast.error('Create a free account to copy this fix prompt')
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      if (isTrackedKind(kind)) {
        trackEvent('fix_prompt_copied', {
          kind,
          audit_id: auditId,
          tool,
          surface,
          access_state: accessState,
          item_position: itemPosition,
        })
      }
      setCopied(true)
      toast.success(successMessage, successDescription ? { description: successDescription } : undefined)
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      toast.error('Could not copy to clipboard')
      return false
    }
  }, [])

  return { copied, copy }
}
