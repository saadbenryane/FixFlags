import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputGroupProps = React.HTMLAttributes<HTMLDivElement>

export function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 overflow-hidden rounded-card p-1.5 glass-surface-elevated shadow-glass sm:rounded-full',
        'transition-shadow duration-200',
        'focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-focus-ring/25',
        'sm:flex-row sm:items-stretch sm:gap-0',
        className
      )}
      {...props}
    />
  )
}

export type InputGroupInputProps = React.InputHTMLAttributes<HTMLInputElement>

export const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 min-h-12 min-w-0 flex-1 rounded-full border-0 bg-transparent px-3.5 py-0 text-base leading-none shadow-none',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
InputGroupInput.displayName = 'InputGroupInput'

export type InputGroupButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex h-12 min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold',
        'transition-[color,background-color,box-shadow,transform] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
        'sm:w-auto sm:min-w-[10.5rem] sm:px-6',
        className
      )}
      {...props}
    />
  )
)
InputGroupButton.displayName = 'InputGroupButton'
