'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageUrlEntry } from './HomepagePrimitives'
import { SignatureSequence } from './SignatureSequence'
import s from './HomepageHero.module.css'

export type HomepageDetailCard = SiteCardArea

/** The product is the hero: the promise and URL entry beside one sample Flag from check to verified fix. */
export function HomepageHero() {
  return <section className={s.hero}>
    <div className={s.layout}>
      <div className={s.copy}>
        <h1><span>{C.hero.headline[0]}</span>{' '}<span>{C.hero.headline[1].slice(0, -1)}<span className={s.period}>{C.hero.headline[1].slice(-1)}</span></span></h1>
        <p className={s.description}>{C.hero.body}</p>
        <HomepageUrlEntry className={s.entry} />
        <p className={s.note}>{C.hero.setup}<Link href={C.hero.sampleHref}>{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
      </div>
      <div className={s.sequence}><SignatureSequence /></div>
    </div>
  </section>
}
