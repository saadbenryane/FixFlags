'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function FilterPill({ className, active, children, ...props }: FilterPillProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        active
          ? 'bg-accent text-foreground shadow-filterPill'
          : 'bg-muted/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
