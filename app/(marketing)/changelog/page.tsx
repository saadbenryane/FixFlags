import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { CHANGELOG_ENTRIES, CHANGELOG_PAGE } from '@/lib/marketing/copy'
import { blogDate } from '@/lib/marketing/copy/blog'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('changelog', '/changelog')

export default function ChangelogPage() {
  return (
    <Section spacing="marketing" className="scroll-mt-[var(--header-offset)]">
      <MarketingPageViewTracker page="/changelog" />
      <Container className="mx-auto max-w-3xl space-y-8 sm:space-y-10 lg:space-y-12">
        <div className="space-y-4">
          <LandingSectionHeader
          label={CHANGELOG_PAGE.label}
          headline={CHANGELOG_PAGE.headline}
          align="left"
          as="h1"
          />
          <p className="text-base leading-relaxed text-muted-foreground">{CHANGELOG_PAGE.body}</p>
          <Link href="/docs" className="inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline">{CHANGELOG_PAGE.docsCta}</Link>
        </div>

        <ol className="space-y-8">
          {CHANGELOG_ENTRIES.map((entry) => (
            <li key={entry.date} className="space-y-3 border-b border-border/30 pb-8 last:border-0">
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
import Link from 'next/link'
