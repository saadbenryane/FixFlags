'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Route } from 'next'
import { Logo } from '@/components/brand/Logo'
import { INTEGRATIONS_PAGE } from '@/lib/marketing/copy/integrations'
import { HomepageCheckoutExample } from './HomepageCheckoutExample'
import { ArrowRight, Copy } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import { HomepageIntro, HomepageUrlEntry } from './HomepagePrimitives'
import s from './CareHomepage.module.css'

export type HomepageCopySource = 'read' | 'share' | 'ai'
export type HomepageCopyResult = { source: HomepageCopySource; message: string } | null

export function HomepageWorkflowSection({ onCopy, copyResult }: {
  onCopy: (source: HomepageCopySource) => void
  copyResult: HomepageCopyResult
}) {
  const [after, setAfter] = useState(false)
  return <section className={`${s.section} ${s.story}`} id="flag-example">
    <HomepageIntro label={C.story.label} title={C.story.title} body={C.story.body} />
    <div className={s.storyGrid}>
      <div className={s.storyContent}>
        <div className={s.storySwitch} role="group" aria-label={C.story.label}>
          <button type="button" aria-pressed={!after} onClick={() => setAfter(false)}>{C.story.before}</button>
          <button type="button" aria-pressed={after} onClick={() => setAfter(true)}>{C.story.after}</button>
        </div>
        <div aria-live="polite" className={s.storyAnswer}>
          <h3>{after ? C.story.afterTitle : C.story.beforeTitle}</h3>
          <p>{after ? C.story.afterBody : C.story.beforeBody}</p>
        </div>
        {!after ? <div className={s.storyGuidance}>
          <h4>{C.story.guidanceTitle}</h4><p>{C.story.guidance}</p>
          <button type="button" onClick={() => onCopy('share')}><Copy size={16} aria-hidden="true" />{C.story.copy}</button>
          <p role="status">{copyResult?.source === 'share' ? copyResult.message : ''}</p>
        </div> : null}
        <details className={s.storyAbout}><summary>{C.story.about}</summary><p>{C.story.aboutBody}</p></details>
      </div>
      <figure className={s.storyCapture}>
        <figcaption>{C.story.sample}</figcaption>
        <HomepageCheckoutExample recovered={after} />
      </figure>
    </div>

  </section>
}

export function HomepageIntegrationsSection() {
  return <section className={`${s.section} ${s.integrations}`} id="integrations">
    <HomepageIntro label={C.integrations.label} title={C.integrations.title} body={C.integrations.body} />
    <div className={s.orbitalField}>
      <Image src="/marketing/visuals/integrations-orbital-field-v1.webp" alt="" fill sizes="(max-width: 767px) 100vw, 1120px" className={s.orbitalBackdrop} />
      <div className={s.orbitalCenter}><Logo variant="mark" size="lg" /><span>FixFlags</span><small>{C.integrations.center}</small></div>
      <div className={s.integrationOrbit}>{INTEGRATIONS_PAGE.items.map(item => <Link key={item.id} href={item.href as Route} className={s.integrationNode} data-integration={item.id}>
        <span className={s.integrationLogo}><Image src={item.logo} alt="" width={28} height={28} /></span>
        <span><strong>{item.title}</strong><small>{item.purpose}</small></span>
      </Link>)}</div>
    </div>
    <Link href="/integrations" className={s.integrationLink}>{C.integrations.action}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>
}

export function HomepageFinalSection() {
  return <section className={`${s.section} ${s.final}`} id="plans"><h2>{C.close.title}</h2><p>{C.close.body}</p><HomepageUrlEntry final /><Link href="/pricing" className={s.textLink}>{C.close.pricing}<ArrowRight size={16} aria-hidden="true" /></Link></section>
}
