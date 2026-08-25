import type { Metadata } from 'next'
import { DemoLanding } from '@/components/demo/DemoLanding'
import { resolveDemoFixture } from '@/lib/demo/resolve-fixture'
import { v0Fixture } from '@/lib/demo/fixtures/v0'

const fixture = resolveDemoFixture('')

export const metadata: Metadata = fixture.metadata

export default async function DemoOriginalPage({
  searchParams,
}: {
  searchParams: Promise<{ baseline?: string }>
}) {
  const { baseline } = await searchParams
  return <DemoLanding fixture={baseline === '1' ? v0Fixture : fixture} />
}
