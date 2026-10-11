import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { PUBLIC_SITE_COPY as C } from '@/lib/marketing/copy/public-site'
import { PublicLink } from './PublicInteraction'

export function PublicPageIntro({ page, label, title, body, children }: {
  page: string; label: string; title: string; body: string; children?: React.ReactNode
}) {
  return <>
    <MarketingPageViewTracker page={page} />
    <Container variant="marketing">
      <MarketingPageHeader eyebrow={label} title={title} description={body}>{children}</MarketingPageHeader>
    </Container>
  </>
}

export function PublicPageActions() {
  return <div className="mt-7 flex flex-wrap items-center gap-3">
    <Button asChild variant="brand"><PublicLink href="/new" target="analyze">{C.analyze}<ArrowRight aria-hidden className="ml-2 h-4 w-4" /></PublicLink></Button>
    <Button asChild variant="outline"><PublicLink href="/samples" target="sample">{C.sample}</PublicLink></Button>
  </div>
}

export function PublicPageNextStep() {
  return <Section spacing="tight" tint="subtle">
    <Container variant="marketing">
      <h2 className="text-balance font-display text-3xl font-semibold tracking-display">{C.nextTitle}</h2>
      <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{C.nextBody}</p>
      <PublicPageActions />
    </Container>
  </Section>
}
