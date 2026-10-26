import Link from 'next/link'
import { CareHomepage } from '@/components/marketing/homepage/CareHomepage'
import styles from './DashboardRefinementStudy.module.css'

/** The local preview renders the same components and styles as the homepage sample. */
export function DashboardRefinementStudy() {
  return <main id="main-content" className={styles.study}>
    <header className={styles.toolbar}>
      <h1>Dashboard preview</h1>
      <Link href="/">Back to homepage</Link>
    </header>
    <div className={styles.preview}><CareHomepage dashboardOnly /></div>
  </main>
}
