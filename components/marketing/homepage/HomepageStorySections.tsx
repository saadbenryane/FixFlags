'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Activity, ArrowRight, Bot, Coins, Copy, Gauge, Link2, ShieldCheck, Sparkles, Video } from 'lucide-react'
import { InteractiveButton, InteractiveTextarea } from '@/components/ui/interactive-controls'
import { EditorMark } from '@/components/brand/EditorMarks'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import { MarketingSectionHeader } from '../MarketingSectionHeader'
import type { HomepageCopyResult, HomepageCopySource } from './HomepageSections'
import s from './CareHomepage.module.css'
import t from './HomepageStorySections.module.css'

const AI = C.builtForAi

const WAY_ICONS = { paste: Copy, agent: Bot, record: Link2 } as const
const REASON_ICONS = { tokens: Coins, proof: ShieldCheck } as const

/** The handoff: the fix instructions you would copy, the ways they reach your AI, and why that beats asking it to check. */
export function HomepageBuiltForAiSection({ onCopy, copyResult, manualPrompt }: {
  onCopy: (source: HomepageCopySource, prompt: string) => void
  copyResult: HomepageCopyResult
  manualPrompt: string | null
}) {
  const prompt = C.workflow.instructions
  return <section className={s.section} aria-labelledby="built-for-ai-title">
    <MarketingSectionHeader id="built-for-ai-title" label={AI.label} lines={AI.titleLines} lede={AI.body} align="center" />
    <div className={t.handoff}>
      <div className={t.fixCard}>
        <p className={t.fixLabel}><Sparkles size={15} aria-hidden="true" />{AI.cardLabel}<small>{AI.sampleLabel}</small></p>
        <p className={t.fixText}>{prompt}</p>
        <InteractiveButton type="button" className={t.copyButton} onClick={() => onCopy('ai', prompt)}><Copy size={16} aria-hidden="true" />{AI.copy}</InteractiveButton>
        {copyResult?.source === 'ai' ? <p className={t.copyStatus} role="status">{copyResult.message}</p> : null}
        {manualPrompt && copyResult?.source === 'ai' ? <div className={t.manualCopy}><label htmlFor="ai-guidance">{S.guidanceLabel}</label><InteractiveTextarea id="ai-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
      </div>
      <div className={t.ways}>
        <h3 className={t.waysLabel}>{AI.waysLabel}</h3>
        <ol>{AI.ways.map(way => {
          const Icon = WAY_ICONS[way.id]
          return <li key={way.id}>
            <span className={t.wayIcon} aria-hidden="true"><Icon size={18} strokeWidth={1.9} /></span>
            <div>
              <h4>{way.title}</h4>
              <p>{way.body}</p>
              {way.id === 'paste' ? <ul className={t.tools} aria-label={AI.toolsLabel}>{AI.tools.map(tool => <li key={tool.key}>
                <Link href={`/ai-builders/${tool.key}` as Route} aria-label={AI.guideAction(tool.label)}><EditorMark name={tool.label} className={t.toolMark} />{tool.label}</Link>
              </li>)}</ul> : null}
              {'href' in way ? <Link href={way.href as Route} className={t.textLink}>{way.action}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
            </div>
          </li>
        })}</ol>
      </div>
    </div>
    <ul className={t.reasons}>{AI.reasons.map(reason => {
      const Icon = REASON_ICONS[reason.id]
      return <li key={reason.id}><span className={t.reasonIcon} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span><h3>{reason.title}</h3><p>{reason.body}</p></li>
    })}</ul>
  </section>
}

const COMPARE_ICONS = [Gauge, Video, Activity] as const

/** What FixFlags is not, said once and plainly: three short claims, each with the thing it replaces. */
export function HomepageCompareSection() {
  return <section className={`${s.section} ${t.compare}`} aria-labelledby="compare-title">
    <MarketingSectionHeader id="compare-title" label={C.compare.label} lines={C.compare.titleLines} align="center"
      lede={<Link href="/coverage" className={t.textLink}>{C.compare.action}<ArrowRight size={16} aria-hidden="true" /></Link>} />
    <ul className={t.compareList}>{C.compare.items.map((item, index) => {
      const Icon = COMPARE_ICONS[index]
      return <li key={item.title}><span className={t.compareIcon} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span><h3>{item.title}</h3><p>{item.body}</p></li>
    })}</ul>
  </section>
}
