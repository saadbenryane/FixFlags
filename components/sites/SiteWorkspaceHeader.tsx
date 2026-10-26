import type { ReactNode } from 'react'
import styles from './SiteShell.module.css'

/** Site identity, actions and navigation have the same hierarchy in the app and sample. */
export function SiteWorkspaceHeader({ identity, actions, navigation, heading }: {
  identity: ReactNode; actions: ReactNode; navigation: ReactNode; heading?: ReactNode;
}) {
  return <div className={styles.headerGroup}>
    <header className={styles.header}>
      <div className={styles.identity}>{identity}</div>
      <div className={styles.actions}>{actions}</div>
    </header>
    {navigation}
    {heading ? <div className={styles.pageHeading}>{heading}</div> : null}
  </div>
}
