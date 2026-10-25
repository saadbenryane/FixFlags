'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptPreviewButton } from '@/components/ui/prompt-preview'
import { PageFlagReview, type PageReviewFlag } from '@/components/sites/PageFlagReview'
import { FlagEvidenceDetails } from '@/components/sites/FlagEvidenceDetails'
import { SiteFlagSelectionCheckbox, useSiteFlagSelection } from '@/components/sites/SiteFlagSelection'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, sampleFlagsForCategory, type SampleCategory, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { samplePages } from './sample-pages'
import { sampleFixPrompt, SampleFlagSelection } from './SampleFlagSelection'

function SelectionList({ flags }: { flags: readonly PageReviewFlag[] }) {
  const selection = useSiteFlagSelection()
  if (!selection?.active) return null
  return <ul>{flags.map(flag => <li key={flag.id}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} /><span>{flag.title}</span></li>)}</ul>
}

/** The homepage supplies local commands and explicitly illustrative evidence. */
export function SamplePageReview({ onCopyFlag, onCopySelection, onOpenFlag }: {
  onCopyFlag: (card: SampleCategory, id: SampleFlagId) => void;
  onCopySelection?: (prompt: string) => void;
  onOpenFlag: (card: SampleCategory, id: SampleFlagId, trigger?: HTMLElement, origin?: 'pages') => void;
}) {
  const ids = Object.keys(SAMPLE_FLAGS) as SampleFlagId[]
  const category = (id: SampleFlagId) => S.categories.find(card => sampleFlagsForCategory(card).includes(id))!
  const pages = samplePages(ids, () => {}).map(page => ({ ...page, flags: page.flags.map(flag => {
    const id = flag.id as SampleFlagId
    return { id, title: flag.title, evidence: SAMPLE_FLAGS[id].observed,
      area: id === 'contact' ? 'performance' as const : id === 'availability' ? 'site' as const : 'conversion' as const,
      checkId: id === 'contact' ? 'mobile-lcp-poor' : null, priorityBand: flag.priorityBand }
  }) }))
  return <PageFlagReview pages={pages}
    renderFlagActions={flag => {
      const id = flag.id as SampleFlagId
      return <span className="inline-flex flex-wrap items-center gap-1"><Button size="sm" variant="outline" onClick={() => onCopyFlag(category(id), id)}><Copy size={15} aria-hidden />{SITE_BOARD_COPY.copyPrompt}</Button><PromptPreviewButton prompt={SAMPLE_FLAGS[id].prompt} /></span>
    }}
    renderFlagDetails={flag => {
      const id = flag.id as SampleFlagId, sample = SAMPLE_FLAGS[id]
      return <><FlagEvidenceDetails observed={sample.observed} expected={sample.expected} /><Button variant="ghost" size="sm" aria-label={C.open(sample.title)} onClick={event => onOpenFlag(category(id), id, event.currentTarget, 'pages')}>{SITE_BOARD_COPY.openFlag}</Button></>
    }}
    renderPageActions={page => {
      const selected = page.flags.map(flag => flag.id as SampleFlagId), prompt = sampleFixPrompt(selected)
      return <><span className="inline-flex flex-wrap items-center gap-1"><Button size="sm" variant="outline" disabled={!onCopySelection} onClick={() => onCopySelection?.(prompt)}><Copy size={15} aria-hidden />{C.fixSelected(selected.length)}</Button><PromptPreviewButton prompt={prompt} /></span><SampleFlagSelection ids={selected} onCopy={onCopySelection}><SelectionList flags={page.flags} /></SampleFlagSelection></>
    }} />
}
