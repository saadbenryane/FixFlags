'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import Link from 'next/link'
import { NOTIFICATION_EMAIL_COPY as EMAIL } from '@/lib/marketing/copy/notification-emails'
import { ArrowRight, Bell, ChevronDown } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { BrandClosing } from '@/components/marketing/BrandClosing'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import { HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'
import t from './HomepageSections.module.css'

export type HomepageCopySource = 'read' | 'share' | 'ai' | 'all'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

export function HomepageLoopSection({ onOpenFlag }: { onOpenFlag: (trigger: HTMLButtonElement) => void }) {
  return <section className={`${s.section} ${t.loopSection}`} aria-labelledby="homepage-loop-heading">
    <div className={t.monitoringGrid}>
      <div className={t.monitoringIntro}>
        <p className={s.eyebrow}>{C.notifications.label}</p>
        <h2 id="homepage-loop-heading">{C.notifications.title}</h2>
        <p>{C.notifications.body}</p>
        <details className={t.monitoringDetails}>
          <summary>{C.notifications.detailTitle}<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>{C.notifications.detailBody}</p>
        </details>
      </div>
      <figure className={t.emailExample}>
        <figcaption>{C.notifications.sampleLabel}</figcaption>
        <div className={t.emailCard}>
          <div className={t.emailSender}><Logo variant="mark" size="md" /><strong>{C.notifications.sender}</strong><Bell size={16} aria-hidden="true" /></div>
          <h3>{EMAIL.subject(C.notifications.host, 1)}</h3>
          <div className={t.emailFinding}><span aria-hidden="true" /><strong>{C.notifications.flag}</strong><span>/pricing</span></div>
          <InteractiveButton type="button" onClick={event => onOpenFlag(event.currentTarget)} className={t.emailAction}>{C.notifications.action}<ArrowRight size={16} aria-hidden="true" /></InteractiveButton>
        </div>
      </figure>
    </div>
    <ol className={t.loop}>
      {C.workflow.steps.map(step => <li key={step.id}><p className={t.loopLabel}>{step.label}</p><h3>{step.title}</h3><p>{step.body}</p></li>)}
    </ol>
    <Link href="/how-it-works" className={t.loopLink}>{C.workflow.action}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans"><BrandClosing>
    <h2>{C.close.title}</h2><p className={s.finalBody}>{C.close.body}</p><HomepageUrlEntry final />
    <Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link>
  </BrandClosing></section>
}
