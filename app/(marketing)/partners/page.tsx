import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { PARTNERS_COPY } from '@/lib/marketing/partners-copy'

export const metadata = buildPageMetadata('partners', '/partners')

export default function PartnersPage() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <MarketingEyebrow>{PARTNERS_COPY.eyebrow}</MarketingEyebrow>
          <h1 className="font-display text-3xl font-semibold tracking-display sm:text-4xl">
            {PARTNERS_COPY.title}
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">{PARTNERS_COPY.subtitle}</p>
          <p className="text-muted-foreground text-pretty">{PARTNERS_COPY.body}</p>
        </div>

        <div className="space-y-4 rounded-[13px] border border-border/65 bg-background p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight">{PARTNERS_COPY.perksTitle}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {PARTNERS_COPY.perks.map((perk: string) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={`mailto:${PARTNERS_COPY.email}`}>{PARTNERS_COPY.cta}</a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">See Studio plans</Link>
          </Button>
        </div>
      </div>
    </Container>
  )
}
