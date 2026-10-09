'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Desktop dialog, full-height sheet on a phone. Focus trap comes from the dialog. */
export const responsiveDepthClass =
  'max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-card bg-background p-5 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:p-6'

export function ResponsiveDepth({
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(responsiveDepthClass, className)} onCloseAutoFocus={onCloseAutoFocus}>
        {children}
      </DialogContent>
    </Dialog>
  )
}
