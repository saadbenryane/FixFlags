import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy-barrel'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { HomepageUrlEntry } from './HomepagePrimitives'
import s from './HomepageHero.module.css'

export type HomepageDetailCard = SiteCardArea

/** The promise, one line, and the URL box. The product itself follows as the visitor scrolls. */
export function HomepageHero() {
  const [lead, follow] = C.hero.headline
  return <section className={s.hero}>
    <div className={s.atmosphere} aria-hidden="true"><span /><span /><span /></div>
    <div className={s.copy}>
      <p className={s.eyebrow}><span aria-hidden="true" />{C.hero.eyebrow}</p>
      <h1><span>{lead}</span>{' '}<span>{follow.slice(0, -1)}<span className={s.period}>{follow.slice(-1)}</span></span></h1>
      <p className={s.description}>{C.hero.body}</p>
      <HomepageUrlEntry className={s.entry} />
      <p className={s.note}>{C.hero.setup}<Link href={C.hero.sampleHref}>{C.hero.sampleAction}<ArrowRight size={14} aria-hidden="true" /></Link></p>
    </div>
  </section>
}
