import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { BrandClosing } from '@/components/marketing/BrandClosing'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { PUBLIC_SITE_COPY as C } from '@/lib/marketing/copy/public-site'
import { PublicLink } from './PublicInteraction'

export function PublicPageIntro({ page, label, title, lines, body, children }: {
  page: string; label: string; title: string; lines?: readonly [string, string]; body: string; children?: React.ReactNode
}) {
  return <>
    <MarketingPageViewTracker page={page} />
    <Container variant="marketing">
      <MarketingPageHeader eyebrow={label} title={title} lines={lines} description={body}>{children}</MarketingPageHeader>
    </Container>
  </>
}

export function PublicPageActions() {
  return <div className="mt-7 flex flex-wrap items-center gap-3">
    <Button asChild variant="brand" className="h-auto min-h-11 max-w-full whitespace-normal py-3"><PublicLink href="/new" target="analyze">{C.analyze}<ArrowRight aria-hidden className="ml-2 h-4 w-4" /></PublicLink></Button>
    <Button asChild variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-3"><PublicLink href="/samples" target="sample">{C.sample}</PublicLink></Button>
  </div>
}

export function PublicPageNextStep() {
  return <Section spacing="marketing" tint="subtle" aria-labelledby="public-next-step">
    <Container variant="marketing">
      <BrandClosing>
        <MarketingSectionHeader id="public-next-step" lines={C.nextTitleLines} lede={C.nextBody} />
        <PublicPageActions />
      </BrandClosing>
    </Container>
  </Section>
}
