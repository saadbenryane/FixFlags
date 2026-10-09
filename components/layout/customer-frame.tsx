import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared customer frame. The account shell and the selected Site keep their own
 * navigation. Both use this landmark, width, and phone bar.
 */
export function CustomerMain({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className={cn('min-w-0 flex-1', className)}>
      {children}
    </main>
  )
}

export const customerContentWidth = 'mx-auto flex w-full max-w-[1360px]'

export const customerMobileBarClass =
  'fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden'
