import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { PageTitle } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { PARTNERS_COPY } from '@/lib/marketing/partners-copy'

export const metadata = buildPageMetadata('partners', '/partners')

export default function PartnersPage() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="section-label">{PARTNERS_COPY.eyebrow}</p>
          <PageTitle>{PARTNERS_COPY.title}</PageTitle>
          <p className="text-lg text-muted-foreground text-pretty">{PARTNERS_COPY.subtitle}</p>
          <p className="text-muted-foreground text-pretty">{PARTNERS_COPY.body}</p>
        </div>

        <Card className="space-y-4 p-6">
          <h2 className="text-xl font-semibold tracking-heading">{PARTNERS_COPY.perksTitle}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {PARTNERS_COPY.perks.map((perk: string) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        </Card>

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
