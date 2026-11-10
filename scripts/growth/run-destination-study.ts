import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { hasSuccessfulPublicGet, openCheckDestination } from '@/lib/audit/open-check'

const origin = 'https://controlled.example'
const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body>${body}</body></html>`
const booking = page('Book a consultation', '<main><h1>Book a consultation</h1><a href="/times">Choose a time</a></main>')
const missing = page('Page not found', '<main><h1>Page not found</h1><p>Return to the homepage.</p></main>')

type Case = {
  id: string
  path: string
  status: number
  body: string
  design: string
  headers?: Record<string, string>
}

const cases: Case[] = [
  { id: 'booking-control', path: '/book-control', status: 200, body: booking, design: 'The booking page is present in the supplied response.' },
  { id: 'missing-with-404', path: '/removed', status: 404, body: missing, design: 'The response explicitly says the page is missing and returns HTTP 404.' },
  { id: 'booking-soft-404', path: '/book', status: 200, body: missing, design: 'The response says the booking page is missing while returning HTTP 200.' },
  { id: 'booking-repaired', path: '/book', status: 200, body: booking, design: 'The original booking content is restored at the same URL.' },
  { id: 'booking-recurred', path: '/book', status: 200, body: missing, design: 'The explicit missing-page response returns at the same URL.' },
  { id: 'wrong-page', path: '/book-wrong-page', status: 200,
    body: page('Studio home', '<main><h1>Studio home</h1><p>Design and development services.</p></main>'),
    design: 'The response contains a working homepage template instead of the intended booking page.' },
  { id: 'unresolved-shell', path: '/book-shell', status: 200,
    body: page('Studio', '<div id="app">Loading…</div><script src="/app.js"></script>'),
    design: 'The HTML contains a loading shell. The fixture does not exercise what renders after JavaScript runs.' },
  { id: 'access-challenge', path: '/book-protected', status: 200, headers: { 'cf-mitigated': 'challenge' },
    body: page('Just a moment', '<h1>Verify your browser</h1>'),
    design: 'A challenge is returned. The normal destination response is unobserved.' },
  { id: 'incomplete-body', path: '/book-large', status: 200,
    body: booking.replace('</main>', `<p>${'Time slots and instructions. '.repeat(1000)}</p></main>`),
    design: 'The supplied booking document exceeds the default destination body budget.' },
  { id: 'working-404-guide', path: '/docs/repair-a-missing-page', status: 200,
    body: page('How to fix a 404 error', '<main><h1>How to fix a 404 error</h1><p>Open the old link, check the requested path, and restore the route or redirect it.</p></main>'),
    design: 'The requested instructional article is present. Its title and heading discuss HTTP 404.' },
  { id: 'sign-in-required', path: '/members/book', status: 401, headers: { 'www-authenticate': 'Basic realm="Study"' },
    body: page('Sign in', '<main><h1>Sign in to book</h1></main>'),
    design: 'The booking page requires authentication. Its signed-in behavior is unobserved.' },
]

type ComparedCase = Case & { suppliedPage: 'present' | 'missing' }

function originalCase(id: string, suppliedPage: ComparedCase['suppliedPage']): ComparedCase {
  const fixture = cases.find(row => row.id === id)
  if (!fixture) throw new Error(`Unknown comparison control: ${id}`)
  return { ...fixture, suppliedPage }
}

const comparisonCases: ComparedCase[] = [
  originalCase('booking-control', 'present'),
  originalCase('booking-soft-404', 'missing'),
  originalCase('working-404-guide', 'present'),
  { id: 'branded-missing-labels', path: '/brand-missing', status: 200, suppliedPage: 'missing',
    body: page('Page not found | Studio', '<main><h1>404: Page not found at Studio</h1><a href="/">Home</a></main>'),
    design: 'The branded title and heading both say that the page is missing.' },
  { id: 'branded-title-plain-heading', path: '/brand-plain-missing', status: 200, suppliedPage: 'missing',
    body: page('Page not found | Studio', '<main><h1>Page not found</h1><a href="/">Home</a></main>'),
    design: 'The branded title is paired with a plain missing-page heading.' },
  { id: 'bare-404-label', path: '/bare-missing', status: 200, suppliedPage: 'missing',
    body: page('404', '<main><h1>404</h1><a href="/">Home</a></main>'),
    design: 'The error template uses only the number 404 as its title and heading.' },
  { id: 'body-only-missing-message', path: '/body-missing', status: 200, suppliedPage: 'missing',
    body: page('Studio', '<main><h1>Studio</h1><p>The requested page does not exist.</p><a href="/">Home</a></main>'),
    design: 'The missing-page message is in the body with a generic title and heading.' },
  { id: 'contact-extension-404', path: '/phone-booking', status: 200, suppliedPage: 'present',
    body: page('Book by phone', '<main><h1>Book by phone</h1><p>Call extension 404 to make a booking.</p></main>'),
    design: 'The requested contact page is present and 404 is a phone extension.' },
  { id: 'hidden-missing-heading', path: '/hidden-error', status: 200, suppliedPage: 'present',
    body: booking.replace('</main>', '<section hidden><h1>Page not found</h1></section></main>'),
    design: 'The booking document is present and the missing-page heading is hidden.' },
  { id: 'expired-offer-notice', path: '/offer-booking', status: 200, suppliedPage: 'present',
    body: booking.replace('</main>', '<p>Last week’s introductory offer is no longer available.</p></main>'),
    design: 'The booking document is present and the notice refers to a past offer.' },
]

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const root = new URL('../../', import.meta.url)
const selectedSourceFiles = ['lib/audit/open-check.ts', 'lib/audit/soft-404.ts', 'lib/audit/html-document.ts']
const comparisonReceipt = 'docs/growth/metrics/destination-page-response-comparison-2026-11-09.json'
const worktreeReceipt = 'docs/growth/metrics/destination-study-2026-11-09.json'
const servingBaseReceipt = 'lib/growth/evidence/destination-study-serving-base-2026-11-09.json'
const servingBaseRevision = '3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7'
const archiveRevisionEnv = 'FIXFLAGS_DESTINATION_STUDY_ARCHIVE_REVISION'
const htmlHeaders = { 'content-type': 'text/html; charset=utf-8' }

function readReceipt(path: string): StudyReport {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8'))
}

function verifyObservations(saved: StudyReport, actual: StudyReport) {
  if (saved.schemaVersion !== actual.schemaVersion || saved.source.fixtureSha256 !== actual.source.fixtureSha256) {
    throw new Error('Study fixture differs from the saved receipt')
  }
  if (!isDeepStrictEqual(saved.observations, actual.observations)) throw new Error('Study verdicts differ from the saved receipt')
}

function archiveDependencyVersions(directory: string) {
  const lock = readFileSync(join(directory, 'package-lock.json'))
  const packages: Record<string, { version?: string }> = JSON.parse(lock.toString()).packages
  let matchingInstalledVersions = 0
  let lockEntriesNotInstalled = 0
  for (const [path, entry] of Object.entries(packages)) {
    if (!path.startsWith('node_modules/') || !entry.version) continue
    const metadata = new URL(path + '/package.json', root)
    if (!existsSync(metadata)) { lockEntriesNotInstalled++; continue }
    if (JSON.parse(readFileSync(metadata, 'utf8')).version !== entry.version) {
      throw new Error(`Installed package version differs from the archived lockfile at ${path}`)
    }
    matchingInstalledVersions++
  }
  if (!matchingInstalledVersions) throw new Error('Install the repository dependencies before replaying the study')
  return { archiveLockSha256: sha256(lock), matchingInstalledVersions, lockEntriesNotInstalled }
}

function verifyServingBase() {
  const saved = readReceipt(servingBaseReceipt)
  if (saved.source.baseRevision !== servingBaseRevision || saved.source.node !== process.version) {
    throw new Error('Serving receipt needs the recorded Git revision and Node version')
  }
  const temporary = mkdtempSync(join(tmpdir(), 'fixflags-study-archive-'))
  try {
    const archive = join(temporary, 'source.tar')
    const directory = join(temporary, 'source')
    mkdirSync(directory)
    execFileSync('git', ['archive', '--format=tar', '--output=' + archive, servingBaseRevision], { cwd: root })
    execFileSync('tar', ['-xf', archive, '-C', directory])
    const sources = Object.fromEntries(selectedSourceFiles.map(path => [path, sha256(readFileSync(join(directory, path)))]))
    if (!isDeepStrictEqual(sources, saved.source.selectedFileSha256)) throw new Error('Archived evaluator files differ from the saved fingerprints')
    const dependencies = archiveDependencyVersions(directory)
    const runner = join('scripts', 'growth', 'run-destination-study.ts')
    mkdirSync(join(directory, 'scripts', 'growth'), { recursive: true })
    copyFileSync(fileURLToPath(import.meta.url), join(directory, runner))
    symlinkSync(fileURLToPath(new URL('node_modules', root)), join(directory, 'node_modules'), 'dir')
    const actual: StudyReport = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', runner], {
      cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: 'test',
        [archiveRevisionEnv]: servingBaseRevision },
    }))
    verifyObservations(saved, actual)
    if (!isDeepStrictEqual(saved.source, actual.source)) throw new Error('Archived replay source differs from the saved receipt')
    console.log(JSON.stringify({ ...actual, verification: { mode: 'archived-serving-base', observationsMatched: true,
      selectedSourcesMatched: true, ...dependencies,
      limitations: ['Dependency checks compare installed package version metadata with the archived lockfile. They do not attest installed package bytes.'],
    } }, null, 2))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

async function observeDestination(fixture: Case) {
  const url = origin + fixture.path
  const result = await openCheckDestination(url, { fetchImpl: async (requested, options) => {
    if (requested !== url || options?.method !== 'GET') throw new Error('Unexpected study request')
    return new Response(fixture.body, {
      status: fixture.status,
      headers: { ...htmlHeaders, ...fixture.headers },
    })
  } })
  if (result.status !== fixture.status) throw new Error(`No recorded fixture response for ${fixture.id}`)
  return {
    caseId: fixture.id,
    path: fixture.path,
    fixtureDesign: fixture.design,
    httpStatus: result.status,
    statusOnly2xx: result.status >= 200 && result.status < 300,
    destinationOutcome: result.outcome,
    classifiedAsDeadDestination: result.shouldFlagDead,
    successfulPublicGetEvidence: hasSuccessfulPublicGet(result),
  }
}

async function runStudy(compare: boolean) {
  const observedAt = new Date().toISOString()
  const fixtures = compare ? comparisonCases : cases
  const sourceFiles = compare ? [...selectedSourceFiles, 'lib/audit/checks/page-response.ts'] : selectedSourceFiles
  const assess = compare ? (await import('@/lib/audit/checks/page-response')).assessPageResponse : null
  const observations = []
  for (const fixture of fixtures) {
    const destination = await observeDestination(fixture)
    if (!assess || !('suppliedPage' in fixture)) {
      observations.push(destination)
      continue
    }
    if (fixture.status !== 200 || Buffer.byteLength(fixture.body) > 20_000) throw new Error('Comparison requires complete HTTP 200 HTML')
    const url = origin + fixture.path
    const response = assess(url, { url, finalUrl: url, status: fixture.status, headers: { ...htmlHeaders, ...fixture.headers },
      body: fixture.body, complete: true, reason: null, redirects: [], collectedAt: observedAt })
    observations.push({ ...destination, suppliedPage: fixture.suppliedPage,
      pageResponseOutcome: !response.complete ? 'inconclusive' : response.flags.length ? 'failure' : 'success',
      pageResponseCheckIds: response.flags.map(flag => flag.checkId) })
  }
  const archivedRevision = process.env[archiveRevisionEnv]
  if (archivedRevision && archivedRevision !== servingBaseRevision) throw new Error('Invalid archived replay revision')
  return {
    schemaVersion: compare ? 'fixflags.controlled-destination-page-response-comparison.v1' : 'fixflags.controlled-destination-study.v1',
    observedAt,
    method: compare ? 'paired destination and page-response checks with the same complete synthetic HTTP 200 HTML'
      : 'existing destination evaluator with synthetic GET responses',
    source: {
      baseRevision: archivedRevision ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      selectedFileSha256: Object.fromEntries(sourceFiles.map(path => [path, sha256(readFileSync(new URL(path, root)))])),
      fixtureSha256: sha256(JSON.stringify(fixtures)),
      node: process.version,
    },
    limitations: [
      'Hand-authored cases, not a sample of customer sites or AI builder output.',
      'Injected HTTP responses exercise the destination check, not network collection, browser rendering or the booking action.',
      'The case descriptions are fixture design facts. Classifier outcomes are observations and may disagree with them.',
      ...(compare ? ['The page-response check receives the same complete document as controlled evidence. Its success concerns the response alone.'] : []),
    ],
    observations,
  }
}

type StudyReport = Awaited<ReturnType<typeof runStudy>>

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--verify-serving-base') return verifyServingBase()
  const compare = args[0] === '--compare-page-response'
  const verify = args[compare ? 1 : 0] === '--verify'
  if (args.length !== Number(compare) + Number(verify)) {
    throw new Error('Use --verify-serving-base, --verify, or --compare-page-response [--verify], or omit options')
  }
  const report = await runStudy(compare)
  if (verify) {
    const saved = readReceipt(compare ? comparisonReceipt : worktreeReceipt)
    verifyObservations(saved, report)
    console.log(JSON.stringify({ ...report, verification: { mode: 'worktree-behavior', observationsMatched: true,
      selectedSourcesMatched: isDeepStrictEqual(saved.source.selectedFileSha256, report.source.selectedFileSha256),
      nodeVersionMatched: saved.source.node === report.source.node,
    } }, null, 2))
    return
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Destination study failed')
  process.exitCode = 1
})
