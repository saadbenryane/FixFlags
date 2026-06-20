import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import type { DeterministicFlag } from '@/lib/audit/checks'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { v1Fixture } from '@/lib/demo/fixtures/v1'
import type { DemoFixture } from '@/lib/demo/types'
import {
  DEMO_FIXTURE_ORIGIN,
  DEMO_LOCAL_DEV_BASE,
  sortDemoFlags,
} from '@/lib/demo/demo-audit-scope'
import { fetchDemoPageHtml, isDemoLocalhostUrl } from '@/lib/demo/audit-demo-local'
import { renderFixtureHtml } from '@/lib/demo/render-fixture-html'
import { runFixtureChecks } from '@/lib/demo/run-fixture-checks'

export type DemoFixtureKey = 'original' | 'v1'
export type DemoAuditMode = 'live' | 'offline'

const FIXTURES: Record<DemoFixtureKey, DemoFixture> = {
  original: originalFixture,
  v1: v1Fixture,
}

export interface DemoFixtureAuditResult {
  key: DemoFixtureKey
  path: string
  url: string
  mode: DemoAuditMode
  flags: DeterministicFlag[]
}

export interface DemoFixtureComparison {
  mode: DemoAuditMode
  baseUrl: string
  baseline: DemoFixtureAuditResult
  fixed: DemoFixtureAuditResult
  clearedCheckIds: string[]
  remainingCheckIds: string[]
}

export async function auditDemoFixture(
  key: DemoFixtureKey,
  options: { mode: DemoAuditMode; baseUrl?: string }
): Promise<DemoFixtureAuditResult> {
  const fixture = FIXTURES[key]
  const path = fixture.path || '/demo'
  const mode = options.mode

  if (mode === 'offline') {
    const pageUrl = `${DEMO_FIXTURE_ORIGIN}${path}`
    const html = renderFixtureHtml(fixture, DEMO_FIXTURE_ORIGIN)
    const metadata = parseMetadataFromHtml(html, pageUrl)
    const flags = sortDemoFlags(await runFixtureChecks(pageUrl, metadata))
    return { key, path, url: pageUrl, mode, flags }
  }

  const baseUrl = (options.baseUrl ?? DEMO_LOCAL_DEV_BASE).replace(/\/$/, '')
  const url = `${baseUrl}${path}`
  if (!isDemoLocalhostUrl(url)) {
    throw new Error('Live demo fixture audit only supports localhost (use production URL with full audit pipeline)')
  }
  const { html, finalUrl } = await fetchDemoPageHtml(url)
  const checkUrl = `${DEMO_FIXTURE_ORIGIN}${path}`
  const metadata = parseMetadataFromHtml(html, checkUrl)
  const flags = sortDemoFlags(await runFixtureChecks(checkUrl, metadata))
  return { key, path, url: finalUrl, mode, flags }
}

export async function compareDemoFixtures(options: {
  mode: DemoAuditMode
  baseUrl?: string
}): Promise<DemoFixtureComparison> {
  const baseline = await auditDemoFixture('original', options)
  const fixed = await auditDemoFixture('v1', options)

  const baselineIds = new Set(baseline.flags.map((f) => f.checkId))
  const fixedIds = new Set(fixed.flags.map((f) => f.checkId))
  const clearedCheckIds = [...baselineIds].filter((id) => !fixedIds.has(id)).sort()
  const remainingCheckIds = [...fixedIds].sort()

  return {
    mode: options.mode,
    baseUrl: options.baseUrl ?? (options.mode === 'offline' ? DEMO_FIXTURE_ORIGIN : DEMO_LOCAL_DEV_BASE),
    baseline,
    fixed,
    clearedCheckIds,
    remainingCheckIds,
  }
}

export async function isDemoDevServerRunning(
  baseUrl = DEMO_LOCAL_DEV_BASE
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/demo`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
