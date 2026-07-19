'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: 'sm' | 'md'
  icon?: LucideIcon
}

export function FilterPill({ className, active, size = 'md', icon: Icon, children, ...props }: FilterPillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-medium transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        size === 'sm' ? 'min-h-7 px-2.5 py-1 text-2xs' : 'min-h-9 px-3.5 py-1.5 text-sm',
        active
          ? 'bg-accent text-foreground shadow-filter-pill'
          : 'bg-muted/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4', children ? 'mr-1' : '')} aria-hidden />}
      {children}
    </button>
  )
}
