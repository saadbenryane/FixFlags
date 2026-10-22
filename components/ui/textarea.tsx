import * as React from "react"
import { cn } from "@/lib/utils"
import { InteractiveTextarea } from './interactive-controls'
import { hasClientInteraction } from './client-interaction'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const Comp = hasClientInteraction(props) ? InteractiveTextarea : 'textarea'
    return (
      <Comp
        className={cn(
          "flex min-h-[80px] w-full rounded-[var(--radius-control)] border border-border bg-background px-4 py-3 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
