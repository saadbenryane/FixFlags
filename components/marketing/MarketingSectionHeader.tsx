import type { ReactNode } from 'react'
import s from './MarketingSectionHeader.module.css'

/** The one section header for public pages: a mono kicker, a two-line statement
 * whose second line is muted, and an optional lede. */
export function MarketingSectionHeader({ id, index, label, lines, lede, align = 'start', level = 2, children }: {
  id: string
  index?: string
  label?: string
  lines: readonly [string, string]
  lede?: ReactNode
  align?: 'start' | 'center' | 'split'
  level?: 2 | 3
  children?: ReactNode
}) {
  const Title = level === 3 ? 'h3' : 'h2'
  return <div className={s.header} data-align={align}>
    {label ? <p className={s.kicker}>{index ? <span>{index}</span> : null}{label}</p> : null}
    <Title id={id} className={s.title}><span>{lines[0]}</span> <span>{lines[1]}</span></Title>
    {lede ? <p className={s.lede}>{lede}</p> : null}
    {children}
  </div>
}
