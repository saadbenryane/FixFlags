import type { Metadata } from 'next'
import { DemoLanding } from '@/components/demo/DemoLanding'
import { originalFixture } from '@/lib/demo/fixtures/original'

export const metadata: Metadata = originalFixture.metadata

export default function DemoOriginalPage() {
  return <DemoLanding fixture={originalFixture} />
}
