"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-modal bg-overlay/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

function keepDialogFocusVisible(event: React.FocusEvent<HTMLDivElement>) {
  const container = event.currentTarget
  const target = event.target
  if (!(target instanceof Element) || !container.contains(target) || container.clientHeight === 0) return
  const area = container.getBoundingClientRect()
  const focused = target.getBoundingClientRect()
  const inset = Math.min(8, Math.max(0, (area.height - Math.min(44, focused.height)) / 2))
  const top = area.top + inset
  const bottom = area.bottom - inset
  if (focused.top < top || focused.height > bottom - top) container.scrollTop += focused.top - top
  else if (focused.bottom > bottom) container.scrollTop += focused.bottom - bottom
}

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  header: React.ReactNode
  bodyClassName?: string
  initialFocus?: 'title' | 'automatic'
}

/** Keep the heading and dismissal control outside the independently scrolling content. */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, header, bodyClassName, initialFocus = 'automatic', onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const headerRef = React.useRef<HTMLDivElement>(null)
  const openerRef = React.useRef<HTMLElement | null>(null)
  const [heading, setHeading] = React.useState<HTMLDivElement | null>(null)
  const [headingScrollable, setHeadingScrollable] = React.useState(false)
  const [headingLabel, setHeadingLabel] = React.useState<string>()
  const bindHeading = React.useCallback((element: HTMLDivElement | null) => {
    headerRef.current = element
    setHeading(element)
  }, [])
  React.useLayoutEffect(() => {
    if (!heading) { setHeadingScrollable(false); setHeadingLabel(undefined); return }
    const measure = () => {
      setHeadingScrollable(heading.scrollHeight > heading.clientHeight)
      setHeadingLabel(heading.querySelector<HTMLElement>('[data-dialog-title]')?.id)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(heading)
    if (heading.firstElementChild) observer.observe(heading.firstElementChild)
    measure()
    return () => observer.disconnect()
  }, [heading])
  return <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-modal grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] overflow-hidden glass-surface-elevated shadow-card duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-card",
        className
      )}
      onOpenAutoFocus={event => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        onOpenAutoFocus?.(event)
        if (!event.defaultPrevented && initialFocus === 'title') {
          const title = headerRef.current?.querySelector<HTMLElement>('[data-dialog-title]')
          if (title) { event.preventDefault(); title.focus({ preventScroll: true }) }
        }
      }}
      onCloseAutoFocus={event => {
        onCloseAutoFocus?.(event)
        const opener = openerRef.current
        if (!event.defaultPrevented && opener?.isConnected && opener !== document.body && !opener.matches(':disabled,[aria-disabled="true"]')) {
          event.preventDefault()
          opener.focus()
        }
      }}
      {...props}
    >
      <div ref={bindHeading} data-dialog-heading-scroll className="max-h-[50dvh] min-h-0 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-focus-ring"
        role={headingScrollable ? 'region' : undefined} aria-labelledby={headingScrollable ? headingLabel : undefined}
        tabIndex={headingScrollable ? 0 : undefined} onFocusCapture={keepDialogFocusVisible}>
        <div data-dialog-header className="min-h-[60px] px-5 pb-4 pr-16 pt-5 sm:px-6 sm:pr-16 sm:pt-6">{header}</div>
      </div>
      <div data-dialog-scroll className={cn("grid min-h-0 content-start gap-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-1 sm:px-6 sm:pb-6", bodyClassName)}
        onFocusCapture={keepDialogFocusVisible}>
        {children}
      </div>
      <DialogPrimitive.Close data-dialog-close className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-dialog-title
    tabIndex={-1}
    className={cn("text-lg font-semibold leading-heading tracking-heading", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
