'use client'

import Link from 'next/link'
import type { Route } from 'next'
import type { HTMLAttributes } from 'react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { siteDetailContextHref } from '@/lib/sites/workspace-location'
import { useSiteWorkspaceLocation } from './SiteWorkspaceLocation'

export type FlagDestination =
  | { href: string; onOpen?: (trigger: HTMLElement) => void }
  | { href?: undefined; onOpen?: (trigger: HTMLButtonElement) => void }

/** Real Flag destinations retain browser navigation; local disclosures remain buttons. */
export function SiteFlagTarget({ href, onOpen, ...props }: FlagDestination & Pick<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'id' | 'aria-label' | 'title'>) {
  const origin = useSiteWorkspaceLocation()
  if (href !== undefined && (!onOpen || !href.startsWith('#'))) {
    return <Link {...props} href={siteDetailContextHref(href, origin) as Route} prefetch={onOpen ? false : undefined} onClick={event => {
      if (!onOpen || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      onOpen(event.currentTarget)
    }} />
  }
  if (onOpen) return <InteractiveButton {...props} type="button" onClick={event => onOpen(event.currentTarget)} />
  return <span {...props} />
}
