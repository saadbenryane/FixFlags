import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const pageGridVariants = cva('grid grid-cols-12 gap-6 lg:gap-8', {
  variants: {
    align: {
      start: 'items-start',
      center: 'items-center',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
  },
  defaultVariants: {
    align: 'start',
  },
})

const colSpanMap = {
  full: 'col-span-12',
  half: 'col-span-12 lg:col-span-6',
  text: 'col-span-12 lg:col-span-7',
  card: 'col-span-12 lg:col-span-5',
  sidebar: 'col-span-12 lg:col-span-4',
  main: 'col-span-12 lg:col-span-8',
  intro: 'col-span-12 lg:col-span-5',
  content: 'col-span-12 lg:col-span-7',
} as const

export type PageGridCol = keyof typeof colSpanMap

export interface PageGridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageGridVariants> {}

export function PageGrid({ className, align, ...props }: PageGridProps) {
  return <div className={cn(pageGridVariants({ align }), className)} {...props} />
}

export function PageGridCol({
  span = 'full',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { span?: PageGridCol }) {
  return <div className={cn(colSpanMap[span], className)} {...props} />
}
