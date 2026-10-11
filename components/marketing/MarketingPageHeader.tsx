import type { ReactNode } from 'react'
import { MarketingEyebrow } from './MarketingEyebrow'
import s from './MarketingPageHeader.module.css'

export function MarketingPageHeader({ eyebrow, title, description, children, id }: {
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode
  id?: string
}) {
  return <header className={s.header} aria-labelledby={id}>
    {eyebrow && eyebrow !== title ? <MarketingEyebrow className={s.eyebrow}>{eyebrow}</MarketingEyebrow> : null}
    <h1 id={id} className={s.title}>{title}</h1>
    {description ? <p className={s.description}>{description}</p> : null}
    {children ? <div className={s.actions}>{children}</div> : null}
  </header>
}
