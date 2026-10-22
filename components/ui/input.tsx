import * as React from "react"
import { cn } from "@/lib/utils"
import { InteractiveInput } from './interactive-controls'
import { hasClientInteraction } from './client-interaction'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const Comp = hasClientInteraction(props) ? InteractiveInput : 'input'
    return (
      <Comp
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-4 py-2 text-base shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
