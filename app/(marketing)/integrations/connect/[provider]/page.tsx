import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { INTEGRATIONS_PAGE } from '@/lib/marketing/copy-barrel'
import { SITE_CONNECTION_COPY } from '@/lib/marketing/copy/site-connections'
import styles from './ConnectPage.module.css'

export default async function ConnectIntegrationPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const selected = INTEGRATIONS_PAGE.items.find(item => item.id === provider)
  if (!selected) notFound()
  if (selected.status === 'available') redirect('/settings/integrations')
  return <main className={styles.page}>
    <Link href="/integrations" className={styles.back}>{INTEGRATIONS_PAGE.hero.label}</Link>
    <p className={styles.eyebrow}>{SITE_CONNECTION_COPY.comingSoon}</p>
    <h1>{selected.title}</h1>
    <p className={styles.intro}>{selected.summary}</p>
    <p className={styles.notice}>{SITE_CONNECTION_COPY.comingSoonBody}</p>
    <Link href="/" className={styles.action}>{INTEGRATIONS_PAGE.checkWebsite}</Link>
  </main>
}
