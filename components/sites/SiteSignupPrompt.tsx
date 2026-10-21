'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import styles from './SiteSignupPrompt.module.css'

/** A contextual invitation. Reading evidence never opens an account modal. */
export function SiteSignupPrompt({ siteId, checking, paused = false }: {
  siteId: string; auditId: string | null; checking: boolean; paused?: boolean
}) {
  const { user, isLoading, error } = useMe()
  if (user || isLoading || error || checking || paused) return null
  const next = encodeURIComponent(`/sites/${siteId}`)
  return <section className={styles.prompt} aria-labelledby="save-site-heading">
    <div><h2 id="save-site-heading">{C.signupPrompt.title}</h2>
      <p>{C.signupPrompt.body}</p></div>
    <Button asChild><Link href={`/sign-up?next=${next}`}>{C.access.save}</Link></Button>
  </section>
}
