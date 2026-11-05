'use client'

import type { SiteCardArea } from '@/lib/sites/card-areas'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { SiteRepairPrompt } from './SiteRepairPrompt'

export function SiteFixBundleButton({ siteId, area, flagIds, availability, ...presentation }: {
  siteId: string; area?: SiteCardArea; flagIds?: string[]; availability: SiteActionAvailability;
  label?: string; presentation?: 'button' | 'preview';
}) {
  return <SiteRepairPrompt scope={{ kind: 'bundle', siteId, ...(area ? { area } : {}), ...(flagIds ? { flagIds } : {}) }} availability={availability} {...presentation} />
}
