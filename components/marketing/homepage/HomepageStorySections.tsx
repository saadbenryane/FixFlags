'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Check, Copy, Terminal } from 'lucide-react'
import { InteractiveButton, InteractiveTextarea } from '@/components/ui/interactive-controls'
import { EditorMark } from '@/components/brand/EditorMarks'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'
import type { HomepageCopyResult, HomepageCopySource } from './HomepageSections'
import s from './CareHomepage.module.css'
import t from './HomepageStorySections.module.css'

const AI = C.builtForAi
const PROOF = C.independent

export function HomepageProofSection() {
  return <section className={`${s.section} ${t.proof}`} aria-labelledby="proof-title">
    <div className={t.proofCopy}>
      <p className={s.eyebrow}>{PROOF.label}</p>
      <h2 id="proof-title">{PROOF.title}</h2>
      <p>{PROOF.body}</p>
      <ul className={t.points}>{PROOF.points.map(point => <li key={point}><Check size={16} aria-hidden="true" />{point}</li>)}</ul>
      <Link href="/how-it-works" className={t.textLink}>{PROOF.action}<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    <figure className={t.captures}>
      <div className={t.capturePair}>
        <div className={t.capture} data-state="before">
          <p><span>{PROOF.beforeLabel}</span>{PROOF.beforeTitle}</p>
          <Image src={HOMEPAGE_EVIDENCE.failed} alt={PROOF.beforeAlt} width={780} height={1520} sizes="(max-width: 767px) 44vw, 240px" />
        </div>
        <div className={t.capture} data-state="after">
          <p><span>{PROOF.afterLabel}</span>{PROOF.afterTitle}</p>
          <Image src={HOMEPAGE_EVIDENCE.passed} alt={PROOF.afterAlt} width={780} height={1520} sizes="(max-width: 767px) 44vw, 240px" />
        </div>
      </div>
      <figcaption>{PROOF.sampleNote}</figcaption>
    </figure>
  </section>
}

export function HomepageBuiltForAiSection({ onCopy, copyResult, manualPrompt }: {
  onCopy: (source: HomepageCopySource, prompt: string) => void
  copyResult: HomepageCopyResult
  manualPrompt: string | null
}) {
  const id = useId()
  const [active, setActive] = useState(0)
  const tool = AI.tools[active]
  const prompt = C.workflow.instructions
  const select = (index: number) => {
    const next = (index + AI.tools.length) % AI.tools.length
    setActive(next)
    document.getElementById(`${id}-tool-${next}`)?.focus()
  }
  return <section className={`${s.section} ${t.ai}`} aria-labelledby="built-for-ai-title">
    <div className={t.aiCopy}>
      <p className={s.eyebrow}>{AI.label}</p>
      <h2 id="built-for-ai-title">{AI.title}</h2>
      <p>{AI.body}</p>
    </div>
    <div className={t.aiDemo}>
      <div className={t.toolTabs} role="tablist" aria-label={AI.toolsLabel}>
        {AI.tools.map((item, index) => <button key={item.key} id={`${id}-tool-${index}`} type="button" role="tab" aria-selected={index === active}
          aria-controls={`${id}-tool-panel`} tabIndex={index === active ? 0 : -1} className={t.toolTab} onClick={() => setActive(index)} onKeyDown={event => {
            if (event.key === 'ArrowRight') { event.preventDefault(); select(active + 1) }
            if (event.key === 'ArrowLeft') { event.preventDefault(); select(active - 1) }
          }}>
          <EditorMark name={item.label} className={t.toolMark} />{item.label}
        </button>)}
      </div>
      <div id={`${id}-tool-panel`} role="tabpanel" aria-labelledby={`${id}-tool-${active}`} className={t.toolPanel}>
        <div className={t.window} data-surface={tool.surface}>
          <div className={t.windowBar}>{tool.surface === 'terminal' ? <Terminal size={14} aria-hidden="true" /> : <EditorMark name={tool.label} className={t.windowMark} />}<span>{tool.label}</span><small>{AI.sampleLabel}</small></div>
          {tool.surface === 'terminal'
            ? <pre className={t.terminalText}><span aria-hidden="true">&gt; </span>{prompt}</pre>
            : <div className={t.chat}><p className={t.bubble}>{prompt}</p><p className={t.chatInput} aria-hidden="true">{AI.chatPlaceholder(tool.label)}</p></div>}
        </div>
        <p className={t.where}>{tool.where}</p>
        <div className={t.aiActions}>
          <InteractiveButton type="button" className={t.copyButton} onClick={() => onCopy('ai', prompt)}><Copy size={16} aria-hidden="true" />{C.story.copy}</InteractiveButton>
          <Link href={`/ai-builders/${tool.key}` as Route} className={t.textLink}>{AI.guideAction(tool.label)}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {copyResult?.source === 'ai' ? <p className={t.copyStatus} role="status">{copyResult.message}</p> : null}
        {manualPrompt && copyResult?.source === 'ai' ? <div className={t.manualCopy}><label htmlFor="ai-guidance">{S.guidanceLabel}</label><InteractiveTextarea id="ai-guidance" readOnly value={manualPrompt} onFocus={event => event.currentTarget.select()} rows={6} /></div> : null}
      </div>
    </div>
  </section>
}

export function HomepageCompareSection() {
  return <section className={`${s.section} ${t.compare}`} aria-labelledby="compare-title">
    <p className={s.eyebrow}>{C.compare.label}</p>
    <h2 id="compare-title">{C.compare.title}</h2>
    <ul className={t.compareList}>{C.compare.items.map(item => <li key={item.title}><h3>{item.title}</h3><p>{item.body}</p></li>)}</ul>
    <Link href="/coverage" className={t.textLink}>{C.compare.action}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>
}
