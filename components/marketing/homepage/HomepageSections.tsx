'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import Link from 'next/link'
import { NOTIFICATION_EMAIL_COPY as EMAIL } from '@/lib/marketing/copy/notification-emails'
import { ArrowRight, Bell, Check, ChevronDown, Flag } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { BrandClosing } from '@/components/marketing/BrandClosing'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HomepageUrlEntry } from './HomepagePrimitives'
import { MarketingSectionHeader } from '../MarketingSectionHeader'
import s from './CareHomepage.module.css'
import t from './HomepageSections.module.css'

export type HomepageCopySource = 'read' | 'ai' | 'all'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

const N = C.notifications

/** After launch: a fortnight of daily checks on the example site, the one email that mattered, and when FixFlags writes. */
export function HomepageLoopSection({ onOpenFlag }: { onOpenFlag: (trigger: HTMLButtonElement) => void }) {
  return <section className={s.section} aria-labelledby="homepage-loop-heading">
    <MarketingSectionHeader id="homepage-loop-heading" label={N.label} lines={N.titleLines} lede={N.body} align="center">
      <div className={t.alerts}><span>{N.alertsLabel}</span><ul>{N.alerts.map(alert => <li key={alert}>{alert}</li>)}</ul></div>
    </MarketingSectionHeader>
    <figure className={t.watch}>
      <figcaption>{N.sampleLabel}</figcaption>
      <div className={t.watchBoard}>
        <div className={t.watchHead}><Logo variant="mark" size="sm" /><strong>{N.host}</strong><span>{N.watch.schedule}</span></div>
        <ol className={t.ticks} aria-hidden="true">{N.watch.checks.map((state, index) => <li key={index} data-state={state} style={{ '--i': index } as React.CSSProperties} />)}</ol>
        <p className={t.axis} aria-hidden="true"><span>{N.watch.from}</span><span>{N.watch.to}</span></p>
        <ul className={t.events}>{N.watch.events.map(event => <li key={event.text} data-kind={event.kind}><i aria-hidden="true">{event.kind === 'flag' ? <Flag size={12} strokeWidth={2.6} /> : <Check size={12} strokeWidth={3} />}</i><span>{event.when}</span><strong>{event.text}</strong></li>)}</ul>
      </div>
      <div className={t.emailCard}>
        <div className={t.emailSender}><Logo variant="mark" size="md" /><strong>{N.sender}</strong><Bell size={16} aria-hidden="true" /></div>
        <h3>{EMAIL.subject(N.host, 1)}</h3>
        <div className={t.emailFinding}><span aria-hidden="true" /><strong>{N.flag}</strong><span>/pricing</span></div>
        <InteractiveButton type="button" onClick={event => onOpenFlag(event.currentTarget)} className={t.emailAction}>{N.action}<ArrowRight size={16} aria-hidden="true" /></InteractiveButton>
      </div>
    </figure>
    <details className={t.monitoringDetails}>
      <summary>{N.detailTitle}<ChevronDown size={16} aria-hidden="true" /></summary>
      <p>{N.detailBody}</p>
    </details>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans" aria-labelledby="final-title"><BrandClosing>
    <h2 id="final-title" className={s.finalTitle}><span>{C.close.titleLines[0]}</span> <span>{C.close.titleLines[1]}</span></h2><p className={s.finalBody}>{C.close.body}</p><HomepageUrlEntry final />
    <Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link>
  </BrandClosing></section>
}
