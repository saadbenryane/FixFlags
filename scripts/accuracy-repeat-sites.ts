/** Repeat native public-page observations without treating unavailable providers as passes. */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { getAuditBrowser, closeBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { profileForDevice } from '@/lib/audit/browser/capture-profile'
import { observeRenderedCopy } from '@/lib/audit/browser/rendered-copy'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { measureMobileLayout } from '@/lib/audit/capture-metrics'
import { runAllChecks } from '@/lib/audit/checks'
import { flagFingerprint } from '@/lib/audit/flag-identity'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'

const targets = ['https://fixflags.com', 'https://saadbenryane.com', 'https://1health.ae', 'https://github.com', 'https://developer.mozilla.org']
const selectedModules = ['content', 'slop', 'messaging-clarity', 'visual-hierarchy', 'layout']
const outputIndex = process.argv.indexOf('--out')
const directory = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : 'test-results/accuracy-repeat')
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

async function main() {
  const source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
    checkVersions: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, check]) => [id, check.version])) }
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const browser = await getAuditBrowser()
  const results: unknown[] = []
  try {
    for (const [siteIndex, url] of targets.entries()) for (let repeat = 1; repeat <= 3; repeat++) for (const device of ['desktop', 'mobile'] as const) {
      const key = `${siteIndex + 1}-${repeat}-${device}`
      const startedAt = new Date().toISOString()
      let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
      try {
        session = await createAuditPage(browser, url, { profile: profileForDevice(device) })
        const page = session.page
        const copy = await observeRenderedCopy(page)
        const metadata = { ...parseMetadataFromHtml(await page.content(), page.url()), renderedCopy: copy }
        const metrics = device === 'mobile' ? await measureMobileLayout(page) : null
        const evaluate = () => runAllChecks(page.url(), metadata, null, null, session!.consoleErrors, undefined, metrics, session!.responseHeaders, undefined, true, selectedModules, { renderedCopy: copy })
        const first = await evaluate(), replay = await evaluate()
        const canonical = (result: typeof first) => result.flags.map(flag => ({ identity: flagFingerprint(flag), pageUrl: flag.pageUrl ?? page.url(), problem: flag.problem, evidence: flag.evidence })).sort((a, b) => a.identity.localeCompare(b.identity) || a.evidence.localeCompare(b.evidence))
        const observations = canonical(first)
        const stableOnIdenticalEvidence = JSON.stringify(observations) === JSON.stringify(canonical(replay))
        const png = await page.screenshot({ fullPage: false, type: 'png' })
        writeFileSync(path.join(directory, key + '.png'), png, { mode: 0o600 })
        const result = { key, url, finalUrl: page.url(), device, repeat, startedAt, recordedAt: new Date().toISOString(), copy, copySha256: sha256(JSON.stringify(copy)), captureSha256: sha256(png), stableOnIdenticalEvidence, flags: first.flags, executions: first.executions }
        results.push(result)
        writeFileSync(path.join(directory, key + '.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
        if (!stableOnIdenticalEvidence) process.exitCode = 1
        console.log(JSON.stringify({ key, url, device, flags: first.flags.length, stableOnIdenticalEvidence, failedModules: first.failedModules }))
      } catch (error) {
        const result = { key, url, device, repeat, startedAt, status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
        results.push(result)
        process.exitCode = 1
        console.log(JSON.stringify(result))
      } finally {
        session?.disposeNetwork()
        await session?.page.context().close().catch(() => {})
        writeFileSync(path.join(directory, 'summary.json'), JSON.stringify({ source, generatedAt: new Date().toISOString(), settings: { targets, repeats: 3, devices: ['desktop', 'mobile'], selectedModules }, limits: ['Native selected checks only. Full analysis, AI, providers, account journeys and field performance remain outside this probe.', 'Captures show browser emulation, not physical-device validation or a human usability study.'], results }, null, 2), { mode: 0o600 })
      }
    }
  } finally { await closeBrowser() }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
