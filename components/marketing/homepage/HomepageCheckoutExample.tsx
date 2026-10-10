import Image from 'next/image'
import { ArrowRight, Check, Flag, ShoppingBag } from 'lucide-react'
import { CARE_HOME as C } from '@/lib/marketing/copy'
import s from './CareHomepage.module.css'

/** Deliberate product illustration, never presented as a captured customer screenshot. */
export function HomepageCheckoutExample({ recovered = false }: { recovered?: boolean }) {
  const example = C.story.example
  return <div className={s.checkoutExample} role="region" aria-label={recovered ? example.recoveredLabel : example.failedLabel}>
    <div className={s.checkoutStore}><strong>{example.store}</strong><span><ShoppingBag size={15} aria-hidden="true" />{example.basket}</span></div>
    <div className={s.checkoutProduct}><Image className={s.productInitial} src="/marketing/evidence/everyday-tote-product-v2.webp" alt="" width={54} height={64} /><div><strong>{example.product}</strong><span>{example.productDetail}</span></div><strong>{example.price}</strong></div>
    <div className={s.checkoutResult} data-recovered={recovered}>
      {recovered ? <Check size={26} aria-hidden="true" /> : <Flag size={26} aria-hidden="true" />}
      <h4>{recovered ? example.recoveredTitle : example.failedTitle}</h4>
      <p>{recovered ? example.recoveredBody : example.failedBody}</p>
      {recovered ? <div className={s.checkoutFields}><span>{example.contact}</span><span>{example.delivery}</span></div> : <div className={s.checkoutError}>{example.error}</div>}
    </div>
    <div className={s.checkoutReceipt}>
      <span>{example.checked}</span><div><Check size={15} aria-hidden="true" />{example.page}<ArrowRight size={14} aria-hidden="true" /><span>{recovered ? example.checkoutPassed : example.checkoutFailed}</span></div>
      <p>{example.scope}</p>
    </div>
  </div>
}
