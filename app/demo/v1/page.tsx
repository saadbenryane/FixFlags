import type { Metadata } from 'next'
import { DemoLanding } from '@/components/demo/DemoLanding'
import { resolveDemoFixture } from '@/lib/demo/resolve-fixture'

const fixture = resolveDemoFixture('v1')

export const metadata: Metadata = fixture.metadata

export default function DemoV1Page() {
  return <DemoLanding fixture={fixture} />
}
