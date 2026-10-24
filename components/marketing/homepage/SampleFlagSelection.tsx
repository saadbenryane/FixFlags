'use client'

import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptPreviewButton } from '@/components/ui/prompt-preview'
import { SiteFlagSelection } from '@/components/sites/SiteFlagSelection'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SAMPLE_FLAGS, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'

export const sampleFixPrompt = (ids: readonly SampleFlagId[]) => [C.sampleBundleIntro, C.sampleReference, ...C.bundleInstructions,
  ...ids.map(id => SAMPLE_FLAGS[id].prompt)].join('\n\n')

/** Uses the real selection UI with a local fixture handoff, without production commands. */
export function SampleFlagSelection({ ids, onCopy, children }: { ids: readonly SampleFlagId[]; onCopy?: (prompt: string) => void; children: ReactNode }) {
  return <SiteFlagSelection siteId="sample" flags={ids.map(id => ({ id }))} availability="available" renderSelected={selected => {
    const prompt = sampleFixPrompt(selected.filter((id): id is SampleFlagId => Object.hasOwn(SAMPLE_FLAGS, id)))
    return <span className="inline-flex flex-wrap items-center gap-1"><Button size="sm" disabled={!onCopy} onClick={() => onCopy?.(prompt)}><Copy aria-hidden />{C.fixSelected(selected.length)}</Button><PromptPreviewButton prompt={prompt} /></span>
  }}>{children}</SiteFlagSelection>
}
