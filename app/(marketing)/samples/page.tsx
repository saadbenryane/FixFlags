import Link from 'next/link'
import { AuditReport } from '@/components/audit/AuditReport'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Body } from '@/components/ui/typography'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { SAMPLE_STRIPE_AUDIT } from '@/lib/marketing/sample-audit'

export const metadata = buildPageMetadata('samples', '/samples')

export default function SamplesPage() {
  return (
    <>
      <Container className="max-w-4xl pt-8 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary">Sample report</Badge>
            <Badge variant="outline">Free tier preview</Badge>
            <Body className="text-muted-foreground text-sm">{SAMPLES_PAGE.subhead}</Body>
          </div>
          <Body className="text-muted-foreground text-xs">{SAMPLES_PAGE.tierNote}</Body>
        </div>
      </Container>

      <AuditReport
        audit={SAMPLE_STRIPE_AUDIT}
        isPaid={false}
        isLoggedIn={false}
        variant="sample"
      />

      <Container className="max-w-4xl pb-12 text-center">
        <Button asChild size="lg">
          <Link href="/">{SAMPLES_PAGE.bottomCta}</Link>
        </Button>
      </Container>
    </>
  )
}
