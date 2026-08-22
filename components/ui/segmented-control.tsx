'use client'

import * as React from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface SegmentedControlItem {
  value: string
  label: React.ReactNode
  disabled?: boolean
  /** Accessible name when the visible label is icon-only. */
  'aria-label'?: string
  /** Native destination for URL-backed tabs. */
  href?: string
  id?: string
  controls?: string
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
  lg: 'min-h-11 min-w-11 rounded-[calc(var(--radius-card)-4px)] px-2 py-1',
} as const

export function SegmentedControl({
  value,
  onValueChange,
  items,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps) {
  const tabRefs = React.useRef<Array<HTMLElement | null>>([])

  const moveFocus = (currentIndex: number, key: string) => {
    const enabled = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
    if (enabled.length === 0) return
    const currentPosition = enabled.findIndex(({ index }) => index === currentIndex)
    let nextPosition = currentPosition >= 0 ? currentPosition : 0
    if (key === 'Home') nextPosition = 0
    if (key === 'End') nextPosition = enabled.length - 1
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextPosition = (nextPosition + 1) % enabled.length
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextPosition = (nextPosition - 1 + enabled.length) % enabled.length
    }
    const next = enabled[nextPosition]
    if (!next) return
    tabRefs.current[next.index]?.focus()
    onValueChange(next.item.value)
  }

  return (
    <div role="tablist" className={cn(trackClasses[size], className)} {...aria}>
      {items.map((item, index) => {
        const active = value === item.value
        const className = cn(
          itemClasses[size],
          'inline-flex items-center justify-center gap-1.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
          active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )
        const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
          if (
            event.key !== 'ArrowRight' &&
            event.key !== 'ArrowLeft' &&
            event.key !== 'ArrowDown' &&
            event.key !== 'ArrowUp' &&
            event.key !== 'Home' &&
            event.key !== 'End'
          ) return
          event.preventDefault()
          moveFocus(index, event.key)
        }
        const tabProps = {
          id: item.id,
          role: 'tab',
          'aria-selected': active,
          'aria-controls': item.controls,
          'aria-label': item['aria-label'],
          tabIndex: active ? 0 : -1,
          className,
          onKeyDown,
        } as const

        return item.href ? (
          <Link
            key={item.value}
            {...tabProps}
            ref={(node) => { tabRefs.current[index] = node }}
            href={item.href as Route}
            aria-disabled={item.disabled || undefined}
            onClick={(event) => {
              event.preventDefault()
              if (!item.disabled) onValueChange(item.value)
            }}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.value}
            {...tabProps}
            ref={(node) => { tabRefs.current[index] = node }}
            type="button"
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
