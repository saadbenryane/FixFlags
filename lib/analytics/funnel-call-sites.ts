import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

/** Helpers that wrap trackEvent for specific funnel events. */
const EVENT_ALIASES: Record<string, string> = {
  trackLandingView: 'landing_view',
  trackMarketingPageView: 'marketing_page_view',
}

const SKIP_FILES = new Set([
  'lib/analytics/events.ts',
  'lib/analytics/funnel-call-sites.ts',
])

export function parseFunnelEvents(): string[] {
  const content = readFileSync(join(ROOT, 'lib/analytics/events.ts'), 'utf8')
  const match = content.match(
    /export type FunnelEvent =\s*\n([\s\S]*?)\n\nexport type ReportSurface/,
  )
  if (!match) throw new Error('Could not parse FunnelEvent union in lib/analytics/events.ts')
  return [...match[1].matchAll(/\|\s*'([^']+)'/g)].map((m) => m[1])
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(full, files)
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      files.push(full)
    }
  }
  return files
}

function eventCallPatterns(event: string): RegExp[] {
  return [
    new RegExp(`trackEvent\\(['"]${event}['"]`),
    new RegExp(`useOneShotEvent\\(\\s*['"]${event}['"]`),
  ]
}

/** Map each FunnelEvent to source files that emit it. */
export function findFunnelCallSites(): Map<string, string[]> {
  const events = parseFunnelEvents()
  const found = new Map<string, Set<string>>(
    events.map((event) => [event, new Set<string>()]),
  )

  for (const file of collectSourceFiles(ROOT)) {
    const rel = relative(ROOT, file)
    if (SKIP_FILES.has(rel) || rel.includes('__tests__')) continue

    const content = readFileSync(file, 'utf8')

    for (const event of events) {
      if (eventCallPatterns(event).some((pattern) => pattern.test(content))) {
        found.get(event)!.add(rel)
      }
    }

    for (const [helper, event] of Object.entries(EVENT_ALIASES)) {
      if (content.includes(helper)) {
        found.get(event)!.add(rel)
      }
    }
  }

  return new Map([...found.entries()].map(([event, files]) => [event, [...files]]))
}

export function missingFunnelCallSites(): string[] {
  return [...findFunnelCallSites()]
    .filter(([, files]) => files.length === 0)
    .map(([event]) => event)
}
