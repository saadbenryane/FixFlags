import * as React from "react"
import { cn } from "@/lib/utils"
import { fieldVariants } from "@/components/ui/icon-input"

export interface IconTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  fieldVariant?: keyof typeof fieldVariants
}

export const IconTextarea = React.forwardRef<HTMLTextAreaElement, IconTextareaProps>(
  ({ label, error, fieldVariant = "default", className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-")
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="space-y-1">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          aria-describedby={errorId}
          aria-invalid={!!error}
          className={cn(
            "flex min-h-[120px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            fieldVariants[fieldVariant],
            className
          )}
          placeholder={props.placeholder ?? label}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-destructive px-1">
            {error}
          </p>
        )}
      </div>
    )
  }
)
IconTextarea.displayName = "IconTextarea"
