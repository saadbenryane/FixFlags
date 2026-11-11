import type { ReactNode } from 'react'
import s from './MarketingSectionHeader.module.css'

/** The one section header for public pages: a small kicker, a two-line statement
 * set in one ink colour, and an optional lede. */
export function MarketingSectionHeader({ id, label, lines, lede, align = 'start', level = 2, children }: {
  id: string
  label?: string
  lines: readonly [string, string]
  lede?: ReactNode
  align?: 'start' | 'center' | 'split'
  level?: 2 | 3
  children?: ReactNode
}) {
  const Title = level === 3 ? 'h3' : 'h2'
  return <div className={s.header} data-align={align}>
    {label ? <p className={s.kicker}><span aria-hidden="true" />{label}</p> : null}
    <Title id={id} className={s.title}><span>{lines[0]}</span> <span>{lines[1]}</span></Title>
    {lede ? <p className={s.lede}>{lede}</p> : null}
    {children}
  </div>
}
