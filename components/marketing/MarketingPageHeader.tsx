import type { ReactNode } from 'react'
import { MarketingEyebrow } from './MarketingEyebrow'
import s from './MarketingPageHeader.module.css'

/** Page title in the homepage hero type. `lines` sets the two-tone title:
 * one statement, then its muted follow-through. */
export function MarketingPageHeader({ eyebrow, title, lines, description, children, id }: {
  eyebrow?: string
  title?: ReactNode
  lines?: readonly [string, string]
  description?: string
  children?: ReactNode
  id?: string
}) {
  const plainTitle = lines ? lines.join(' ') : typeof title === 'string' ? title : undefined
  return <header className={s.header} aria-labelledby={id}>
    {eyebrow && eyebrow !== plainTitle ? <MarketingEyebrow className={s.eyebrow}>{eyebrow}</MarketingEyebrow> : null}
    <h1 id={id} className={s.title}>{lines ? <><span>{lines[0]}</span> <span>{lines[1]}</span></> : title}</h1>
    {description ? <p className={s.description}>{description}</p> : null}
    {children ? <div className={s.actions}>{children}</div> : null}
  </header>
}
