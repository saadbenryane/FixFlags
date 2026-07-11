import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

const fieldVariants = {
  default: "",
  dark: "border-overlay/20 bg-overlay/20 text-foreground placeholder:text-foreground/60",
  light: "border-input bg-background",
}

export interface IconInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode
  label: string
  error?: string
  fieldVariant?: keyof typeof fieldVariants
}

export const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon, label, error, fieldVariant = "default", className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-")
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="space-y-1">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-foreground/55">
            {icon}
          </span>
          <Input
            ref={ref}
            id={inputId}
            aria-describedby={errorId}
            aria-invalid={!!error}
            className={cn("pl-11", fieldVariants[fieldVariant], className)}
            placeholder={props.placeholder ?? label}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs text-destructive px-1">
            {error}
          </p>
        )}
      </div>
    )
  }
)
IconInput.displayName = "IconInput"

export { fieldVariants }
