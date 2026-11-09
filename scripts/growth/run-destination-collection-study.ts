import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { publicLinkContext } from '@/lib/audit/checks/destination-evidence'
import { checkPublicLinks } from '@/lib/audit/checks/public-links'
import { nativeHttpCollection } from '@/lib/audit/native-http-evidence'

// The literal avoids DNS. The fetch replacement below handles only this
// synthetic request and cannot delegate to a network transport.
const source = 'https://93.184.215.14/'
const destination = new URL('book', source).href
const inventory = { links: [{ href: '/book', text: 'Book', rel: null }], complete: true }
const html = (heading: string, content = '') =>
  `<!doctype html><html><head><title>Studio</title></head><body><h1>${heading}</h1>${content}</body></html>`
const padding = (bytes: number) => '<!--' + 'x'.repeat(bytes) + '-->'
const missing = html('Page not found')
const medium = html('Book a consultation', padding(30_000))
const large = html('Book a consultation', padding(70_000))
const openHeading = '<!doctype html><html><head><title>Studio</title></head><body><h1><!--'
const headingPrefix = '-->Page not found'
const guidanceSuffix = ' in your logs? Check the old URL first.'
const guidance = openHeading + 'x'.repeat(20_000 - Buffer.byteLength(openHeading + headingPrefix)) +
  headingPrefix + guidanceSuffix + '</h1></body></html>'

const fixtures = [
  { id: 'initial-missing', status: 200, body: missing, targeted: false },
  { id: 'ordinary-oversize', status: 200, body: medium, targeted: false },
  { id: 'targeted-within-extended-budget', status: 200, body: medium, targeted: true },
  { id: 'targeted-over-extended-budget', status: 200, body: large, targeted: true },
  { id: 'missing-recurrence', status: 200, body: missing, targeted: false },
  { id: 'explicit-404-with-large-body', status: 404, body: html('Page not found', padding(70_000)), targeted: false },
  { id: 'cut-inside-guidance-heading', status: 200, body: guidance, targeted: false },
  { id: 'complete-guidance-heading', status: 200, body: html('Page not found' + guidanceSuffix), targeted: false },
  { id: 'closed-missing-heading-before-cut', status: 200, body: html('Page not found', padding(70_000)), targeted: false },
]

async function observe(fixture: typeof fixtures[number]) {
  const originalFetch = globalThis.fetch
  let requests = 0
  let collectorStoppedBeforeEnd = false
  globalThis.fetch = async (input, init) => {
    assert.equal(input, destination)
    assert.equal(init?.redirect, 'manual')
    assert.equal(++requests, 1)
    const bytes = new TextEncoder().encode(fixture.body)
    let sent = false
    const stream = new ReadableStream({
      pull(controller) {
        if (sent) controller.close()
        else { controller.enqueue(bytes); sent = true }
      },
      cancel() { collectorStoppedBeforeEnd = true },
    }, { highWaterMark: 0 })
    return new Response(stream, { status: fixture.status, headers: { 'content-type': 'text/html' } })
  }
  try {
    const collected = nativeHttpCollection()
    const contexts = fixture.targeted ? [publicLinkContext(source, destination)] : undefined
    const check = (collection: ReturnType<typeof nativeHttpCollection>) =>
      checkPublicLinks(source, inventory, Date.now() + 5_000, collection.options.openDestination, contexts)
    const observed = await check(collected)
    const saved = collected.snapshot()
    assert.equal(saved.requests.length, 1)
    const receipt = saved.requests[0]
    assert.equal(receipt.kind, 'destination')
    assert.equal(receipt.result.status, fixture.status)
    assert.equal(observed.assertions.length, 1)
    assert(!JSON.stringify(saved).includes(destination))
    const replay = nativeHttpCollection(saved)
    const replayed = await check(replay)
    const summary = (result: typeof observed) => ({
      passed: result.assertions[0].passed,
      complete: result.assertions[0].complete,
      flagCheckIds: result.flags.map(flag => flag.checkId),
    })
    assert.deepEqual(summary(replayed), summary(observed))
    assert.deepEqual(replay.snapshot(), saved)
    assert.equal(requests, 1)
    return { caseId: fixture.id, targeted: fixture.targeted, fixtureBytes: Buffer.byteLength(fixture.body),
      collectorStoppedBeforeEnd, ...receipt.result, ...summary(observed), replayMatched: true }
  } finally {
    globalThis.fetch = originalFetch
  }
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const root = new URL('../../', import.meta.url)
const sources = ['lib/audit/url.ts', 'lib/audit/open-check.ts', 'lib/audit/html-document.ts',
  'lib/audit/soft-404.ts', 'lib/audit/native-http-evidence.ts', 'lib/audit/checks/destination-evidence.ts',
  'lib/audit/checks/public-links.ts', 'scripts/growth/run-destination-collection-study.ts']

async function main() {
  assert.equal(process.argv.length, 2, 'Run without options')
  const observations = []
  for (const fixture of fixtures) observations.push(await observe(fixture))
  console.log(JSON.stringify({
    schemaVersion: 'fixflags.controlled-destination-collection.v1',
    observedAt: new Date().toISOString(),
    method: 'Native bounded collection and public-link assertion replay with synthetic response streams',
    source: {
      baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      selectedFileSha256: Object.fromEntries(sources.map(path => [path, sha256(readFileSync(new URL(path, root)))])),
      fixtureSha256: sha256(JSON.stringify(fixtures)),
      node: process.version,
    },
    limitations: ['No network, browser, customer, database or live repair is exercised.',
      'A passing link assertion is one input to repair verification. This experiment does not issue a verified repair.'],
    observations,
  }, null, 2))
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
