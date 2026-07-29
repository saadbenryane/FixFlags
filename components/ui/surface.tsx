import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

const surfaceVariants = cva('', {
  variants: {
    variant: {
      elevated: 'p-5 sm:p-6',
      nested: 'p-4',
      flat: 'p-4',
      solid: 'p-5 sm:p-6',
    },
    interactive: {
      true: '',
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
    <div
      className={cn(
        cardVariants({ variant, interactive }),
        surfaceVariants({ variant, interactive }),
        className
      )}
      {...props}
    />
  )
}
