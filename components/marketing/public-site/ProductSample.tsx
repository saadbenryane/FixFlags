'use client'

import { CareHomepage } from '@/components/marketing/homepage/CareHomepage'
import { HOMEPAGE_SAMPLE as S } from '@/lib/marketing/copy/care-homepage'
import s from './ProductSample.module.css'

/** The full interactive sample Site. It loads as it nears the viewport. */
export function ProductSample() {
  return <section id="sample" className={s.sample} aria-labelledby="product-sample-title" tabIndex={-1}>
    <div className={s.intro}><h2 id="product-sample-title">{S.title}</h2><p>{S.subtitle}</p></div>
    <CareHomepage dashboardOnly lazy />
  </section>
}
