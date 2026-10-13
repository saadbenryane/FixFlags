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
  'fixed inset-x-0 bottom-0 z-30 flex bg-background/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden'
