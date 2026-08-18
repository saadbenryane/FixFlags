'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedControlItem {
  value: string
  label: React.ReactNode
  disabled?: boolean
  /** Accessible name when the visible label is icon-only. */
  'aria-label'?: string
}

export interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  items: readonly SegmentedControlItem[]
  'aria-label': string
  /** md: pill-in-track control (marketing tabs); lg: bordered workspace switcher. */
  size?: 'md' | 'lg'
  className?: string
}

const trackClasses = {
  md: 'inline-flex rounded-control bg-muted/70 p-0.5',
  lg: 'inline-flex rounded-card border border-border bg-muted/40 p-0.5 text-xs font-medium',
} as const

const itemClasses = {
  md: 'min-h-9 rounded-[calc(var(--radius-control)-4px)] px-3 py-1 text-sm font-medium',
  lg: 'min-h-9 min-w-9 rounded-[calc(var(--radius-card)-4px)] px-2 py-1',
} as const

export function SegmentedControl({
  value,
  onValueChange,
  items,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps) {
  return (
    <div role="tablist" className={cn(trackClasses[size], className)} {...aria}>
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item['aria-label']}
            disabled={item.disabled}
            className={cn(
              itemClasses[size],
              'inline-flex items-center justify-center gap-1.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
