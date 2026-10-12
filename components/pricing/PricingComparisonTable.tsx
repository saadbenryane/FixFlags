import type { Route } from 'next'
import { Activity, CalendarClock, Check, Clock3, Flag, Infinity as InfinityIcon, ListChecks, Minus, ShieldCheck, Users, Zap } from 'lucide-react'
import { PRICING, PRICING_CARDS, PRICING_COMPARISON as C } from '@/lib/marketing/copy/plans'
import { PricingCTAButton } from './PricingCTAButton'
import { PlanPrice } from './PlanPrice'
import s from './PricingComparisonTable.module.css'

const PLAN_KEYS = { FREE: 'free', BUILDER: 'pro', TEAM: 'studio' } as const
const PLAN_ICONS = { FREE: ShieldCheck, BUILDER: Flag, TEAM: Users }
const ROW_ICONS = { checks: ListChecks, uptime: Activity, scheduling: CalendarClock, updates: Zap }
type Cell = (typeof C.rows)[number]['free' | 'pro' | 'studio']

function CellValue({ cell }: { cell: Cell }) {
  return <div className={s.value} data-kind={cell.kind}>
    <strong>{cell.kind === 'included' ? <Check aria-hidden size={17} /> : cell.kind === 'unlimited' ? <InfinityIcon aria-hidden size={19} /> : cell.kind === 'pending' ? <Clock3 aria-hidden size={16} /> : cell.kind === 'excluded' ? <Minus aria-hidden size={16} /> : null}{cell.value}</strong>
    {cell.kind === 'pending' && cell.note ? <span>{cell.note}</span> : null}
  </div>
}

export function PricingComparisonTable() {
  return <div role="group" aria-label={C.caption} className={s.comparison}>
    <div className={s.columns}>{PRICING_CARDS.map(plan => {
      const key = PLAN_KEYS[plan.plan]
      const Icon = PLAN_ICONS[plan.plan]
      return <article key={key} aria-labelledby={`pricing-${plan.plan}`} className={s.plan} data-featured={plan.highlight}>
        <header className={s.planHeading}>
          <div className={s.top}><h3 id={`pricing-${plan.plan}`}><Icon aria-hidden size={22} strokeWidth={1.5} />{plan.name}</h3><span className={s.status}>{plan.badge}</span></div>
          <div className={s.price}><PlanPrice price={plan.price} />{plan.period ? <span>{plan.period}</span> : null}</div>
          <p className={s.priceLabel}>{plan.priceLabel}{plan.plan === 'FREE' ? <> · {plan.products}</> : null}</p>
        </header>
        {C.rows.filter(row => row.id !== 'websites').map(row => {
          const RowIcon = ROW_ICONS[row.id]
          return <dl key={row.id} className={s.fact} data-feature={row.id}><dt><RowIcon aria-hidden size={16} strokeWidth={1.5} />{row.feature}</dt><dd><CellValue cell={row[key]} /></dd></dl>
        })}
        <div className={s.action}><PricingCTAButton plan={plan.plan} cta={plan.cta} signUpHref={plan.href as Route} variant={plan.highlight ? 'brand' : 'outline'} showHint={false} waitlistGated /></div>
      </article>
    })}</div>
    <p className={s.allowanceNote}>{C.allowanceNote}</p>
    <section className={s.included} aria-labelledby="pricing-shared-heading">
      <div><h2 id="pricing-shared-heading">{PRICING.sharedTitle}</h2><p>{PRICING.sharedNote}</p></div>
      <ul>{PRICING.sharedFeatures.map(feature => <li key={feature}><Check aria-hidden size={16} />{feature}</li>)}</ul>
    </section>
  </div>
}
