'use client'

import { useCallback, useRef } from 'react'
import useSWR from 'swr'
import { z } from 'zod'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'

export interface OAuthProviders {
  google: boolean
  github: boolean
}

interface OAuthProvidersState extends OAuthProviders {
  isLoading: boolean
  anyEnabled: boolean
  error: boolean
  retry: () => void
}

const providersSchema = z.object({ google: z.boolean(), github: z.boolean() })
async function readProviders(url: string): Promise<OAuthProviders> {
  const { response, body } = await fetchJsonWithDeadline(url, { cache: 'no-store' }, 15_000)
  if (!response.ok) throw new Error('Provider discovery failed')
  return providersSchema.parse(body)
}

/**
 * Resolves which OAuth providers are enabled by asking the server at runtime
 * (GET /api/auth/providers). This replaces the old build-time NEXT_PUBLIC gate,
 * which baked the answer at `next build` time and kept the buttons hidden in
 * production even after credentials were set as runtime env vars.
 */
export function useOAuthProviders(): OAuthProvidersState {
  // Sign-in pages and report gates share the same public runtime answer and
  // in-flight read. A warm answer stays stable until an explicit retry.
  const { data: providers, error, isLoading, isValidating, mutate } = useSWR('/api/auth/providers', readProviders, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const retrying = useRef(false)
  const retry = useCallback(() => {
    if (retrying.current) return
    retrying.current = true
    void mutate().catch(() => undefined).finally(() => { retrying.current = false })
  }, [mutate])

  return {
    google: providers?.google ?? false,
    github: providers?.github ?? false,
    anyEnabled: !!providers && (providers.google || providers.github),
    isLoading: !providers && (isLoading || isValidating),
    error: Boolean(error),
    retry,
  }
}
