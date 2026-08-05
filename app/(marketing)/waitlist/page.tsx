import { WaitlistLanding } from '@/components/marketing/waitlist/WaitlistLanding'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('waitlist', '/waitlist')

export default function WaitlistPage() {
  return <WaitlistLanding initialPlan="BUILDER" />
}
