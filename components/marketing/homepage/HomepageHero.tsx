'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageUrlEntry } from './HomepagePrimitives'
import { SignatureSequence } from './SignatureSequence'
import s from './HomepageHero.module.css'

export type HomepageDetailCard = SiteCardArea

/** The promise and URL entry, then the product itself: one sample Flag from check to verified fix. */
export function HomepageHero() {
  const [lead, follow] = C.hero.headline
  return <section className={s.hero}>
    <div className={s.copy}>
      <p className={s.eyebrow}><span aria-hidden="true" />{C.hero.eyebrow}</p>
      <h1><span>{lead}</span>{' '}<span className={s.follow}>{follow.slice(0, -1)}<span className={s.period}>{follow.slice(-1)}</span></span></h1>
      <p className={s.description}>{C.hero.body}</p>
      <HomepageUrlEntry className={s.entry} />
      <p className={s.note}>{C.hero.setup}<Link href={C.hero.sampleHref}>{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
    </div>
    <div className={s.sequence}><SignatureSequence /></div>
  </section>
}
