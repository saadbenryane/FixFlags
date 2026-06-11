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
