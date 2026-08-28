'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface WorkspaceMobileTab {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
  controls: string
  href?: string
  icon?: ReactNode
}

/**
 * One tab bar for small screens. The live editor and marketing emulations
 * share this so stacked panes cannot bury Product reality.
 */
export function WorkspaceMobileTabs({
  tabs,
  label,
}: {
  tabs: WorkspaceMobileTab[]
  label: string
}) {
  const tabRefs = useRef<Array<HTMLElement | null>>([])

  const moveFocus = (currentIndex: number, key: string) => {
    let nextIndex = currentIndex
    if (key === 'Home') nextIndex = 0
    if (key === 'End') nextIndex = tabs.length - 1
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    }
    const next = tabs[nextIndex]
    if (!next) return
    tabRefs.current[nextIndex]?.focus()
    next.onSelect()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
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

  const tabContent = (tab: WorkspaceMobileTab) => (
    <span className="inline-flex items-center justify-center gap-1.5">
      {tab.icon ? <span className="shrink-0" aria-hidden>{tab.icon}</span> : null}
      <span>{tab.label}</span>
    </span>
  )

  return (
    <div
      className="flex w-full min-w-0 max-w-full shrink-0 gap-0 overflow-x-auto border-b border-border/40 lg:hidden"
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab, index) => {
        const tabProps = {
          id: tab.id,
          role: 'tab',
          'aria-selected': tab.selected,
          'aria-controls': tab.controls,
          tabIndex: tab.selected ? 0 : -1,
          className: cn(
            'min-h-11 min-w-0 flex-1 px-1.5 text-center text-xs font-medium leading-tight transition-colors [overflow-wrap:anywhere] sm:px-3 sm:text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
            tab.selected ? 'border-b-2 border-brand text-foreground' : 'text-muted-foreground'
          ),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleKeyDown(event, index),
        } as const

        return tab.href ? (
          <Link
            key={tab.id}
            {...tabProps}
            ref={(node) => { tabRefs.current[index] = node }}
            href={tab.href as Route}
            onClick={(event) => {
              event.preventDefault()
              tab.onSelect()
            }}
          >
            {tabContent(tab)}
          </Link>
        ) : (
          <button
            key={tab.id}
            {...tabProps}
            ref={(node) => { tabRefs.current[index] = node }}
            type="button"
            onClick={tab.onSelect}
          >
            {tabContent(tab)}
          </button>
        )
      })}
    </div>
  )
}
