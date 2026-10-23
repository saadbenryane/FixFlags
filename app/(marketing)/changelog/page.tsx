import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { CHANGELOG_ENTRIES, CHANGELOG_PAGE } from '@/lib/marketing/copy-barrel'
import { blogDate } from '@/lib/marketing/copy/blog'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('changelog', '/changelog')

export default function ChangelogPage() {
  return (
    <Section spacing="overview" className="scroll-mt-[var(--header-offset)]">
      <MarketingPageViewTracker page="/changelog" />
      <Container className="mx-auto max-w-3xl">
        <MarketingPageHeader eyebrow={CHANGELOG_PAGE.label} title={CHANGELOG_PAGE.headline} description={CHANGELOG_PAGE.body}>
          <Link href="/docs" className="inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline">{CHANGELOG_PAGE.docsCta}</Link>
        </MarketingPageHeader>

        <ol className="space-y-8">
          {CHANGELOG_ENTRIES.map((entry) => (
            <li key={entry.date} className="space-y-3 pb-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time
                  dateTime={entry.date}
                  className="font-mono text-2xs uppercase tracking-label text-muted-foreground"
                >
                  {blogDate(entry.date)}
                </time>
                <h2 className="text-lg font-semibold">{entry.title}</h2>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
