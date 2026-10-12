import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Flag, Plug, WandSparkles, Waypoints } from 'lucide-react'
import { getDocsPage } from '@/lib/docs/catalog'
import s from './DocsExperience.module.css'

const PATHS = [
  { page: getDocsPage('getting-started'), icon: Waypoints },
  { page: getDocsPage('site-care'), icon: Flag },
  { page: getDocsPage('fix-with-ai'), icon: WandSparkles },
  { page: getDocsPage('integrations'), icon: Plug },
]

export function DocsHomePaths() {
  return <div className={s.paths}>{PATHS.map(({ page, icon: Icon }) => <Link key={page.key} href={page.path as Route} className={s.path}>
    <div className={s.pathTop}><span><Icon aria-hidden size={23} strokeWidth={1.5} /></span><ArrowRight aria-hidden size={17} /></div>
    <h2>{page.title}</h2><p>{page.description}</p>
  </Link>)}</div>
}
