import type { Metadata } from 'next'
import { DemoLanding } from '@/components/demo/DemoLanding'
import { v1Fixture } from '@/lib/demo/fixtures/v1'

export const metadata: Metadata = v1Fixture.metadata

export default function DemoV1Page() {
  return <DemoLanding fixture={v1Fixture} />
}
