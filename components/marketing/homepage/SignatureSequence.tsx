'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BadgeCheck, Check, Flag, ScanSearch, Sparkles, Terminal } from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { SIGNATURE_SEQUENCE as C } from '@/lib/marketing/copy/signature-sequence'
import s from './SignatureSequence.module.css'

const STEPS = C.steps

/**
 * The step is chosen by where its words sit on screen. On wide screens a step becomes current
 * once its heading rises past this share of the viewport; on narrow screens, once it rises
 * past this share of the space left below the pinned phone.
 */
export const STORY_LINE = { wide: .58, narrow: .5 } as const

const STEP_ICONS = { check: ScanSearch, flag: Flag, fix: Sparkles, verify: BadgeCheck } as const

/** Where the visitor is in the story. Decorative: the steps themselves carry the current step. */
function Rail({ active, className }: { active: number; className: string }) {
  return <ol className={className} aria-hidden="true">{STEPS.map((item, index) => {
    const Icon = STEP_ICONS[item.id]
    return <li key={item.id} data-state={index < active ? 'done' : index === active ? 'active' : 'next'}><Icon size={16} strokeWidth={2.1} /></li>
  })}</ol>
}

/** What FixFlags shows beside the phone at each step. Every layer stays in the reading order. */
function Layers() {
  return <>
    <div className={s.layer} data-for="check">
      <div className={s.card}>
        <p className={s.cardHead}><span className={s.live} aria-hidden="true" />{C.check.title}<small>{C.check.state}</small></p>
        <ol className={s.log}>{C.check.log.map((entry, index) => {
          const last = index === C.check.log.length - 1
          return <li key={entry} style={{ '--i': index } as React.CSSProperties} data-pending={last || undefined}>
            {last ? <span className={s.spinner} aria-hidden="true" /> : <Check size={13} strokeWidth={2.6} aria-hidden="true" />}{entry}
          </li>
        })}</ol>
      </div>
    </div>
    <div className={s.layer} data-for="flag">
      <article className={s.card} aria-label={C.flag.label}>
        <p className={s.flagLabel}><Flag size={13} strokeWidth={2.4} aria-hidden="true" />{C.flag.label}</p>
        <p className={s.cardTitle}>{C.flag.title}</p>
        <dl className={s.facts}>{C.flag.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      </article>
    </div>
    <div className={s.layer} data-for="fix">
      <div className={s.terminal}>
        <p className={s.terminalBar}><Terminal size={13} aria-hidden="true" />{C.fix.tool}</p>
        <div className={s.terminalBody}>
          <p className={s.command}><span aria-hidden="true">&gt;</span> {C.fix.command}</p>
          <ul>{C.fix.lines.map((line, index) => <li key={line} style={{ '--i': index } as React.CSSProperties}>{line}</li>)}</ul>
          <p className={s.copyState} aria-hidden="true"><span>{C.fix.copy}</span><span className={s.copied}><Check size={13} strokeWidth={2.6} />{C.fix.copied}</span></p>
        </div>
      </div>
    </div>
    <div className={s.layer} data-for="verify">
      <article className={s.card} aria-label={C.receipt.stamp}>
        <p className={s.stamp}><Check size={14} strokeWidth={3} aria-hidden="true" />{C.receipt.stamp}</p>
        <p className={s.cardTitle}>{C.receipt.title}</p>
        <dl className={s.receipt}>{C.receipt.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </article>
    </div>
  </>
}

/** Scroll through the product: the phone stays in view while Check, Flag, Fix and Verify pass by. */
export function SignatureSequence() {
  const [active, setActive] = useState(0)
  // The Check walk waits until the phone is on screen, so the visitor sees it from the first tap.
  const [seen, setSeen] = useState(false)
  const headings = useRef<(HTMLHeadingElement | null)[]>([])
  const stage = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let frame = 0
    const narrow = window.matchMedia('(max-width: 899px)')
    const update = () => {
      frame = 0
      const box = stage.current?.getBoundingClientRect()
      const below = box?.bottom ?? 0
      if (box && box.top < window.innerHeight * .7) setSeen(true)
      const line = narrow.matches ? below + (window.innerHeight - below) * STORY_LINE.narrow : window.innerHeight * STORY_LINE.wide
      let next = 0
      headings.current.forEach((heading, index) => { if (heading && heading.getBoundingClientRect().top < line) next = index })
      setActive(next)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const step = STEPS[active].id
  return <section className={s.story} data-story aria-labelledby="story-title">
    <h2 id="story-title" className="sr-only">{C.title}</h2>
    <div className={s.stageWrap} ref={stage}>
      <figure className={s.stage} data-step={step} data-seen={seen || undefined} aria-label={C.label}>
        <div className={s.phone}>
          <div className={s.screen}>
            <Image src={C.phone.before} alt={C.phone.beforeAlt} width={780} height={1520} sizes="(max-width: 899px) 250px, 320px" quality={82} className={s.before} />
            <Image src={C.phone.ready} alt="" width={780} height={1520} sizes="(max-width: 899px) 250px, 320px" quality={82} className={s.ready} />
            <Image src={C.phone.home} alt="" width={780} height={1520} sizes="(max-width: 899px) 250px, 320px" quality={82} className={s.home} />
            <Image src={C.phone.after} alt={C.phone.afterAlt} width={780} height={1520} sizes="(max-width: 899px) 250px, 320px" quality={82} className={s.after} />
            <span className={s.tap} aria-hidden="true" />
            <span className={s.ring} aria-hidden="true" />
            <span className={s.marker} aria-hidden="true"><Flag size={12} strokeWidth={2.6} /></span>
          </div>
        </div>
        <Layers />
        <Rail active={active} className={s.railCompact} />
        <figcaption className={s.caption}>{C.label}</figcaption>
      </figure>
    </div>
    <Rail active={active} className={s.rail} />
    <ol className={s.steps}>
      {STEPS.map((item, index) => <li key={item.id} data-active={index === active || undefined} aria-current={index === active ? 'step' : undefined}>
        <div className={s.stepText}>
          <h3 ref={node => { headings.current[index] = node }}>{item.tab}<span aria-hidden="true">.</span></h3>
          <p>{item.caption}</p>
          {item.points.length ? <ul className={s.points}>{item.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
          {item.id === 'fix' ? <ul className={s.points} aria-label={C.toolsLabel}>{C.tools.map(name => <li key={name}><EditorMark name={name} className={s.toolMark} />{name}</li>)}</ul> : null}
          {item.id === 'verify' ? <Link href={C.verifyAction.href as Route} className={s.link}>{C.verifyAction.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </li>)}
    </ol>
  </section>
}
