import * as React from "react"
import { cn } from "@/lib/utils"

export interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("space-y-4", className)}>{children}</div>
}

export interface FormContainerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
}

export function FormContainer({ children, className, ...props }: FormContainerProps) {
  return (
    <form className={cn("space-y-4", className)} {...props}>
      {children}
    </form>
  )
}

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

interface FieldProps {
  label: React.ReactNode
  children: (props: FieldControlProps) => React.ReactNode
  id?: string
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
}

export function Field({
  label,
  children,
  id: providedId,
  description,
  error,
  required,
  className,
}: FieldProps) {
  const generatedId = React.useId()
  const id = providedId ?? generatedId
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden>*</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
