import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const containerVariants = cva('container mx-auto w-full', {
  variants: {
    variant: {
      /** Marketing pages, header, footer — 1024px content column */
      default: 'max-w-5xl',
      /** Settings, billing, account flows */
      narrow: 'max-w-2xl',
      /** Long-form docs, legal */
      prose: 'max-w-[720px]',
      /** Report pages, admin detail */
      report: 'max-w-4xl',
      /** MCP docs, compare, review deliverables */
      content: 'max-w-3xl',
      /** Admin tables and dashboards */
      wide: 'max-w-6xl',
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
