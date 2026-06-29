'use client'

import { useEffect, useState } from 'react'

export interface OAuthProviders {
  google: boolean
  github: boolean
}

interface OAuthProvidersState extends OAuthProviders {
  isLoading: boolean
  anyEnabled: boolean
}

// Cache the result for the lifetime of the page so navigating between
// /sign-in and /sign-up doesn't re-fetch and flash the buttons.
let cached: OAuthProviders | null = null

/**
 * Resolves which OAuth providers are enabled by asking the server at runtime
 * (GET /api/auth/providers). This replaces the old build-time NEXT_PUBLIC gate,
 * which baked the answer at `next build` time and kept the buttons hidden in
 * production even after credentials were set as runtime env vars.
 */
export function useOAuthProviders(): OAuthProvidersState {
  const [providers, setProviders] = useState<OAuthProviders | null>(cached)

  useEffect(() => {
    if (cached) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/providers')
        const data = (await res.json()) as OAuthProviders
        if (cancelled) return
        cached = { google: !!data.google, github: !!data.github }
        setProviders(cached)
      } catch {
        if (!cancelled) {
          cached = { google: false, github: false }
          setProviders(cached)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    google: providers?.google ?? false,
    github: providers?.github ?? false,
    anyEnabled: !!providers && (providers.google || providers.github),
    isLoading: providers === null,
  }
}
