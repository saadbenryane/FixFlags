'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (red). */
  destructive?: boolean
}

/**
 * Promise-based confirmation dialog - a styled, accessible replacement for
 * `window.confirm`. Render `confirmDialog` once in the component and await
 * `confirm(options)`; it resolves `true` on confirm and `false` on cancel or
 * dismiss.
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ title: 'Delete?', destructive: true }))) return
 *   ...
 *   return <div>{confirmDialog}...</div>
 */
export function useConfirm() {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const confirmDialog = (
    <Dialog open={options !== null} onOpenChange={(open) => { if (!open) settle(false) }}>
      <DialogContent className="max-w-md">
        {options && (
          <>
            <DialogHeader>
              <DialogTitle>{options.title}</DialogTitle>
              {options.description && (
                <DialogDescription>{options.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={options.destructive ? 'destructive' : 'default'}
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )

  return { confirm, confirmDialog }
}
