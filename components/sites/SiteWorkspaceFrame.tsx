import type { ReactNode } from 'react'
import { SiteAccountRail } from '@/components/layout/SiteAccountRail'
import { CustomerMain } from '@/components/layout/customer-frame'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import styles from './SiteShell.module.css'

/** Shared Site geometry also applies before its results load and during recovery. */
export function SiteWorkspaceFrame({ mobileHeader, mobileNavigation, overlay, children }: {
  mobileHeader: ReactNode; mobileNavigation?: ReactNode; overlay?: ReactNode; children: ReactNode;
}) {
  return <div className={`${styles.workspace} ${styles.withAccount}`}>
    <SiteAccountRail />
    <header className={styles.mobileAccount} aria-label={SITE_WORKSPACE_COPY.accountMenu}>{mobileHeader}</header>
    <div className={styles.canvas} data-site-content>
      <CustomerMain className="space-y-5">{children}</CustomerMain>
    </div>
    {mobileNavigation}
    {overlay}
  </div>
}
