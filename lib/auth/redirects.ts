import type { Route } from 'next'

export const PAID_PLANS = ['BUILDER', 'TEAM'] as const
const FUNNEL_SOURCES = ['pricing', 'report', 'hero', 'final'] as const

export function sanitizeNextPath(next: string | null): Route | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return null
  try {
    const path = decodeURIComponent(next.split(/[?#]/, 1)[0])
    if (path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path)) return null
  } catch { return null }
  return next as Route
}

export function sanitizeFunnelFrom(from: string | null): string | null {
  if (!from) return null
  return FUNNEL_SOURCES.includes(from as (typeof FUNNEL_SOURCES)[number]) ? from : null
}

export function appendAuthParams(params: URLSearchParams, next: string | null, plan: string | null, from: string | null) {
  if (next) params.set('next', next)
  if (plan && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) params.set('plan', plan)
  if (from) params.set('from', from)
}

export function buildPostLoginQuery(next: string | null, plan: string | null, from: string | null, options?: { newUser?: boolean }): Route {
  const params = new URLSearchParams()
  appendAuthParams(params, next, plan, from)
  // First-time OAuth accounts use the same claim path before signup tracking.
  if (options?.newUser) params.set('signup', '1')
  const qs = params.toString()
  return (qs ? `/post-login?${qs}` : '/post-login') as Route
}

export function postAuthDestination(next: string | null): Route {
  return sanitizeNextPath(next) ?? '/dashboard'
}
