import { AuditReport } from '@/components/audit/AuditReport'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Body } from '@/components/ui/typography'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { SAMPLE_STRIPE_AUDIT } from '@/lib/marketing/sample-audit'

export const metadata = buildPageMetadata('samples', '/samples')

export default function SamplesPage() {
  return (
    <>
      <Container className="max-w-3xl pt-8 pb-2">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Sample report</Badge>
          <Body className="text-muted-foreground text-sm">{SAMPLES_PAGE.subhead}</Body>
        </div>
      </Container>

      <AuditReport
        audit={SAMPLE_STRIPE_AUDIT}
        isPaid
        isLoggedIn={false}
        variant="sample"
      />
    </>
  )
}
