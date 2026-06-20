'use client'

import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import {
  buildEvidenceHighlightsForFlag,
  preferredDeviceForFlag,
} from '@/lib/audit/evidence-highlights'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { RankableFlag } from '@/lib/audit/priority-flags'

interface FlagEvidenceScreenshotProps {
  flag: RankableFlag
  flagIndex: number
  screenshots: AuditScreenshot[]
  host: string
  evidenceAnchors?: EvidenceAnchorMap
  className?: string
}

export function FlagEvidenceScreenshot({
  flag,
  flagIndex,
  screenshots,
  host,
  evidenceAnchors,
  className,
}: FlagEvidenceScreenshotProps) {
  const desktop = screenshots.find((s) => s.device === 'DESKTOP')?.url ?? null
  const mobile = screenshots.find((s) => s.device === 'MOBILE')?.url ?? null
  if (!desktop && !mobile) return null

  const highlights = buildEvidenceHighlightsForFlag(flag, flagIndex, evidenceAnchors)
  const devices = flag.checkId ? devicesForCheck(flag.checkId) : [preferredDeviceForFlag(flag)]

  return (
    <ScreenshotWithHighlights
      host={host}
      desktopScreenshot={desktop}
      mobileScreenshot={mobile}
      highlights={highlights}
      selectedFlagId={flag.id}
      showDesktop={devices.includes('desktop') && Boolean(desktop)}
      showMobile={devices.includes('mobile') && Boolean(mobile)}
      className={className}
    />
  )
}
