import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const containerVariants = cva('container mx-auto w-full', {
  variants: {
    variant: {
      default: 'max-w-7xl',
      prose: 'max-w-[720px]',
      report: 'max-w-4xl',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

export function Container({ className, variant, ...props }: ContainerProps) {
  return <div className={cn(containerVariants({ variant }), className)} {...props} />
}
