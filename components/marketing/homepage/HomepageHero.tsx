'use client'

import Link from 'next/link'
import { ArrowRight, Check, Flag, Sparkles } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { EditorMark } from '@/components/brand/EditorMarks'
import type { EditorMarkName } from '@/lib/integrations/editor-catalog'
import { HomepageUrlEntry } from './HomepagePrimitives'
import { SignatureSequence } from './SignatureSequence'
import s from './HomepageHero.module.css'

export type HomepageDetailCard = SiteCardArea

const STEP_ICON = { working: null, flag: Flag, fix: Sparkles, verified: Check } as const

/**
 * The agent at work: one sample run, one step at a time. Pure CSS timing keeps it
 * off the JavaScript budget; reduced motion shows the finished run instead.
 */
function AgentRun() {
  const { label, steps } = C.hero.run
  return <div className={s.run} style={{ ['--steps' as string]: steps.length }}>
    <span className={s.runLabel}>{label}</span>
    <ol className={s.runSteps} aria-hidden="true">
      {steps.map((step, index) => {
        const Icon = STEP_ICON[step.kind]
        return <li key={step.text} data-kind={step.kind} style={{ ['--i' as string]: index }}>
          <span className={s.runIcon}>{Icon ? <Icon size={13} strokeWidth={2.4} /> : <i />}</span>
          <span className={s.runText}>{step.text}</span>
        </li>
      })}
    </ol>
    <ol className="sr-only">{steps.map(step => <li key={step.text}>{step.text}</li>)}</ol>
  </div>
}

function WorksWith() {
  return <div className={s.worksWith}>
    <p>{C.hero.worksWith}</p>
    <ul>{C.hero.tools.map(name => <li key={name}><EditorMark name={name as EditorMarkName} className={s.toolMark} />{name}</li>)}</ul>
  </div>
}

/** The promise and an agent-style composer, the agent visibly at work, then the product itself. */
export function HomepageHero() {
  const [lead, follow] = C.hero.headline
  return <section className={s.hero}>
    <div className={s.atmosphere} aria-hidden="true"><span /><span /><span /></div>
    <div className={s.copy}>
      <p className={s.eyebrow}><span aria-hidden="true" />{C.hero.eyebrow}</p>
      <h1><span>{lead}</span>{' '}<span className={s.follow}>{follow.slice(0, -1)}<span className={s.period}>{follow.slice(-1)}</span></span></h1>
      <p className={s.description}>{C.hero.body}</p>
      <HomepageUrlEntry className={s.entry} />
      <AgentRun />
      <p className={s.note}>{C.hero.setup}<Link href={C.hero.sampleHref}>{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
      <WorksWith />
    </div>
    <div className={s.sequence}><SignatureSequence /></div>
  </section>
}
