import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { v1Fixture } from '@/lib/demo/fixtures/v1'
import type { DemoFixture } from '@/lib/demo/types'
import { renderFixtureHtml } from '@/lib/demo/render-fixture-html'

const FIXTURES: Record<string, DemoFixture> = {
  original: originalFixture,
  v1: v1Fixture,
}

export async function auditFixtureOffline(
  fixture: DemoFixture,
  pageUrl: string
): Promise<Awaited<ReturnType<typeof runAllChecks>>['flags']> {
  const html = renderFixtureHtml(fixture, new URL(pageUrl).origin)
  const metadata = parseMetadataFromHtml(html, pageUrl)
  const { flags } = await runAllChecks(pageUrl, metadata, null, null, [])
  return flags
}

export async function auditDemoFixturesOffline(origin = 'https://fixflags.com') {
  const results: Record<string, Awaited<ReturnType<typeof auditFixtureOffline>>> = {}
  for (const [key, fixture] of Object.entries(FIXTURES)) {
    const path = fixture.path || '/demo'
    const url = `${origin}${path}`
    results[key] = await auditFixtureOffline(fixture, url)
  }
  return results
}
