import type { JourneyLinkCandidate } from './discover'

const label = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()

/** Planner intent can select an observed route, never manufacture one. */
export function resolveJourneyPlanTarget(target: string, links: readonly JourneyLinkCandidate[], currentUrl: string): JourneyLinkCandidate | null {
  const requested = label(target)
  if (!requested) return null
  const named = links.filter(link => label(link.text) === requested)
  if (named.length) return new Set(named.map(link => link.href)).size === 1 ? named[0] : null
  if (!/^(?:https?:\/\/|\/|\?|#)/i.test(target.trim())) return null
  let href: string
  try { href = new URL(target.trim(), currentUrl).href } catch { return null }
  return links.find(link => link.href === href) ?? null
}
