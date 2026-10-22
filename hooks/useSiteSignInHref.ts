'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { siteNavigationRoot } from '@/lib/sites/navigation-continuity'
import { siteContinuationHref } from '@/lib/sites/viewer-actions'

/** Preserve a Site destination even when its private view is unavailable until sign-in. */
export function useSiteSignInHref(): Route {
  const pathname = usePathname() ?? '/'
  const search = useSearchParams().toString()
  const [hash, setHash] = useState('')
  useEffect(() => {
    const read = () => setHash(window.location.hash)
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [pathname, search])
  return siteNavigationRoot(pathname)
    ? siteContinuationHref('sign_in', pathname + (search ? '?' + search : '') + hash) as Route
    : '/sign-in'
}
