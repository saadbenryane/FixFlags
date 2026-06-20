import type { Metadata } from 'next'
import { DemoLanding } from '@/components/demo/DemoLanding'
import { resolveDemoFixture } from '@/lib/demo/resolve-fixture'

const fixture = resolveDemoFixture('')

export const metadata: Metadata = fixture.metadata

export default function DemoOriginalPage() {
  return <DemoLanding fixture={fixture} />
}
