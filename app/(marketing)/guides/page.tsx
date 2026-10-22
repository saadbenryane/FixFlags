import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import Link from 'next/link'
import type { Route } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { GuideActions } from '@/components/marketing/guides/GuideActions'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import { GUIDES_PAGE, WEBSITE_GUIDES } from '@/lib/marketing/copy/guides'
import s from '@/components/marketing/guides/Guide.module.css'

export const metadata = buildIndexableMetadata({
  title: GUIDES_PAGE.metadataTitle,
  description: GUIDES_PAGE.description,
  path: '/guides',
})

export default function GuidesPage() {
  return <Section spacing="overview">
    <MarketingPageViewTracker page="/guides" />
    <Container variant="marketing">
      <MarketingPageHeader eyebrow={GUIDES_PAGE.eyebrow} title={GUIDES_PAGE.title} description={GUIDES_PAGE.description}>
        <GuideActions />
      </MarketingPageHeader>
      <div className={s.grid}>
        {WEBSITE_GUIDES.map(guide => <article key={guide.slug} className={s.card}>
          <h2><Link href={`/guides/${guide.slug}` as Route}>{guide.title}</Link></h2>
          <p>{guide.description}</p>
        </article>)}
      </div>
    </Container>
  </Section>
}
