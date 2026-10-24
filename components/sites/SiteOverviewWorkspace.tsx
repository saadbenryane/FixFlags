import type { ComponentProps, ReactNode } from 'react'
import { SiteCheckSections } from './SiteCheckSections'
import styles from './SiteOverview.module.css'

/** The product and labeled sample share one overview composition and spacing owner. */
export function SiteOverviewWorkspace({ summary, checksId, ...checks }: ComponentProps<typeof SiteCheckSections> & { summary: ReactNode; checksId?: string }) {
  return <div className={styles.workspace}>{summary}<div id={checksId} tabIndex={checksId ? -1 : undefined}><SiteCheckSections {...checks} /></div></div>
}
