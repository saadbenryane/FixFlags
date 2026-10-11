import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { prisma } from '@/lib/db'
import { googleConnectionConfigured } from '@/lib/sites/connections/google'
import s from './ConnectPage.module.css'

const providers = {
  analytics: { title: 'Google Analytics', anchor: 'connection-analytics' },
  'search-console': { title: 'Google Search Console', anchor: 'connection-search-console' },
} as const

export default async function ConnectIntegrationPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!(provider in providers)) notFound()
  const key = provider as keyof typeof providers
  const selected = providers[key]
  const viewer = await getAppViewer()
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(`/integrations/connect/${provider}`)}`)

  const configured = googleConnectionConfigured()
  const sites = configured ? await prisma.project.findMany({
    where: { userId: viewer.user.id, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, canonicalHost: true },
  }) : []

  return <main className={s.page}>
    <Link href="/integrations" className={s.back}>Integrations</Link>
    <p className={s.eyebrow}>Connect {selected.title}</p>
    <h1>Choose the website to connect.</h1>
    <p className={s.intro}>A connection belongs to one website. Choose a Site you own, then authorize the matching {selected.title} property in Site settings.</p>
    {!configured ? <div className={s.notice} role="status">Google connections are not configured on this FixFlags server yet. Ask the workspace owner to set up Google access before connecting.</div> : sites.length ? <ul className={s.sites}>
      {sites.map(site => <li key={site.id}>
        <Link href={`/sites/${site.id}/settings#${selected.anchor}` as Route}>
          <span><strong>{site.name}</strong><small>{site.canonicalHost}</small></span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </li>)}
    </ul> : <div className={s.empty}>
      <p>Add your website first. You can connect {selected.title} from its settings once it appears in Websites.</p>
      <Link href="/dashboard" className={s.action}>Add a website <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>}
    <Link href="/help/getting-started/connect-google-data" className={s.help}>How these connections work <ArrowRight size={16} aria-hidden="true" /></Link>
  </main>
}
