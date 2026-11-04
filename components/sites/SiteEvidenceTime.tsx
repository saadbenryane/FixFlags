'use client'

import { useMinuteClock } from '@/hooks/useMinuteClock'
import { freshnessLabel } from '@/lib/sites/presentation'
import { formatEvidenceTimestamp } from '@/lib/time/format'

/** Evidence ages locally; the server label remains stable during hydration. */
export function SiteEvidenceTime({ checkedAt, label }: { checkedAt: string; label: string }) {
  const now = useMinuteClock()
  return <time dateTime={checkedAt} title={formatEvidenceTimestamp(checkedAt) ?? undefined}>
    {now === null ? label : freshnessLabel(checkedAt, new Date(now))}
  </time>
}
