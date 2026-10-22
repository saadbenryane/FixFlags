'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import styles from './ResponsiveDepth.module.css'

/** Desktop dialog, full-height sheet on a phone. Focus trap comes from the dialog. */
export const responsiveDepthClass =
  'max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl rounded-card bg-background max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none'

export function ResponsiveDepth({
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
  header,
  className,
  continuationContext,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
  header: ReactNode
  children: ReactNode
  className?: string
  continuationContext?: 'category'
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent header={header} initialFocus="title" data-site-return-context={continuationContext} className={cn(responsiveDepthClass, styles.depth, className)} onCloseAutoFocus={onCloseAutoFocus}>
        {children}
      </DialogContent>
    </Dialog>
  )
}
