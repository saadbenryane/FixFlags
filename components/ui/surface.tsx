import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const surfaceVariants = cva('rounded-card border-0 bg-card text-card-foreground', {
  variants: {
    variant: {
      elevated: 'shadow-card p-5 sm:p-6',
      nested: 'rounded-nested-md bg-muted/20 p-4',
      flat: 'bg-muted/30 p-4',
    },
    interactive: {
      true: 'transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:transition-none',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    interactive: false,
  },
})

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

export function Surface({ className, variant, interactive, ...props }: SurfaceProps) {
  return (
    <div className={cn(surfaceVariants({ variant, interactive }), className)} {...props} />
  )
}
