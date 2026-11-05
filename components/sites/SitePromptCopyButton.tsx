'use client'

import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { SiteRepairPrompt } from './SiteRepairPrompt'

export function SitePromptCopyButton({ siteId, flagId, availability = 'available', ...presentation }: {
  siteId: string; flagId: string; flagTitle?: string; compact?: boolean; iconOnly?: boolean;
  availability?: SiteActionAvailability; presentation?: 'button' | 'preview';
}) {
  return <SiteRepairPrompt scope={{ kind: 'flag', siteId, flagId }} availability={availability} {...presentation} />
}
