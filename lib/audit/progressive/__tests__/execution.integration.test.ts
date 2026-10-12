import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { SECTION_LINK_VERIFICATION_RULE } from '@/lib/audit/checks/section-links'
import { authorizeOutcomeFixture, listOutcomeFixtures } from '@/lib/sites/application/outcome-fixtures'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, closeBrowser, captureScreenshots } from '@/lib/audit/screenshot'
import { encryptSecret } from '@/lib/security/crypto'
import { reconcileTasks, dispatchReadyTasks } from '../engine'
import { searchArtifactSchema } from '../evaluators'
import { readArtifact } from '../contracts'
import { executionWrite, withExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import { SEARCH_LOCAL_MODULES } from '@/lib/audit/search/workflow'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { applyJourneyRouteGuards } from '@/lib/audit/browser/journey-safety'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { classifyTrackingEndpoint } from '@/lib/audit/tracking/endpoints'
import { projectCheckResults } from '@/lib/sites/check-results'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { notifyWatchRegression } from '@/lib/audit/project-watch'
import { fetchPageSpeedData } from '@/lib/audit/pagespeed'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { persistDeterministicFlags } from '@/lib/audit/persist'
import { materializeAttentionForAudit } from '@/lib/improvements/service'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { probeFormValidation } from '@/lib/audit/flow/form-probes'
import { checkFormValidation } from '@/lib/audit/checks/form-validation'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { runSecurityHeaderChecks } from '@/lib/audit/checks/security-headers'
import { collectDocument } from '@/lib/audit/search/collect'
import { requestScheduledSiteRun } from '@/lib/sites/application/scheduled-runs'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { FLAG_COMPARISON_TARGET, type FlagDiffSummary } from '@/lib/audit/flag-comparison'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runTrustChecks } from '@/lib/audit/checks/trust'
import { loadSiteFlags, loadSiteRecommendations } from '@/lib/sites/flags'
import { runConsoleChecks } from '@/lib/audit/checks/console'
import { runAllChecks } from '@/lib/audit/checks'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { PRIMARY_ACTION_VERIFICATION_RULE, PRIMARY_ACTION_CHECKS } from '@/lib/audit/flow/primary-action-evidence'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { runFlowScan } from '@/lib/audit/flow/run-flow-scan'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { Resend } from 'resend'
import { watchAlertDelivery } from '@/lib/audit/watch-notification'

const notificationBoundary = vi.hoisted(() => ({ provider: null as Resend | null }))
vi.mock('@/lib/email/client', () => ({ get resend() { return notificationBoundary.provider } }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('migrated progressive execution', () => {
  const suffix = randomUUID()
  const userId = 'execution-user-' + suffix
  const projectId = 'execution-project-' + suffix
  const origin = 'https://example.com'
  const destinationOrigin = 'https://example.net'
  let releaseResources!: () => void
  const resources = new Promise<void>(resolve => { releaseResources = resolve })
  const requests: string[] = []
  let focusRepaired = false
  let restorationRepaired = false
  let trackingRepaired = false
  let destinationsRepaired = false
  let publicLinksMode: 'failed' | 'blocked' | 'removed' | 'healthy' = 'failed'
  let sectionLinksMode: 'failed' | 'partial' | 'challenge' | 'changed' | 'removed' | 'healthy' = 'failed'
  let primaryActionMode: 'failed' | 'blocked' | 'challenge' | 'competing' | 'changed' | 'removed' | 'healthy' = 'failed'
  let primaryControlMode: 'missing' | 'disabled' | 'deadend' | 'healthy' = 'missing'
  let primaryControlKind: 'button' | 'link' | 'role' = 'button'
  let availabilityChallenged = false
  let availabilityStatus = 200
  let otherAvailabilityStatus = 200
  let signupMode: 'success' | 'missing' | 'preexisting' = 'success'
  let signupCleanupOk = true
  let signupSubmissions = 0
  let pageSpeedMode: 'failed' | 'missing' | 'healthy' | null = null
  let publicFormMode: 'broken' | 'blocked' | 'socket' | 'peer' | 'popup' | 'hidden' | 'unrelated' | 'outside' | 'slow' | 'healthy' | 'native' | 'prefilled' = 'broken'
  let publicFormSubmissions = 0
  let headerMode: 'failed' | 'partial' | 'challenge' | 'redirected' | 'healthy' = 'failed'
  let headerTitleMissing = false
  let monitoredTitleMissing = true
  let monitoredUnavailable = false
  let monitoredChallenge: 'header' | 'title' | null = null
  let trustPrivacy = false, trustContact = false, trustConsent = false, trustUnavailable = false, trustConsoleErrors = false, trustAnalytics = true
  let consoleRootErrors = 3, consoleLinkedErrors = 3, consoleDelayMs = 3500
  let consoleDesktopUnavailable = false, consoleMobileUnavailable = false, consoleRedirected = false, consoleFlood = false
  let consoleRedirectDelayMs = 0
  let accessibilityNames = false, accessibilityOtherNames = false, accessibilityContrast = false, accessibilityAria = false
  let accessibilityUncertain = false, accessibilityOtherUnavailable = false
  const healthyHeaders = {
    'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin', 'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'x-permitted-cross-domain-policies': 'none',
  }
  const server = createServer(async (req, res) => {
    requests.push(req.url!)
    if (req.url === '/sitemap.xml' || req.url === '/canonical') await resources
    if (res.destroyed) return
    if (req.url === '/primary-control') {
      res.setHeader('content-type', 'text/html')
      const control = primaryControlKind === 'button' ? '<button id="primary-action" aria-controls="completion"' + (primaryControlMode === 'disabled' ? ' disabled' : '') + '>Get started</button>'
        : primaryControlKind === 'role' ? '<div id="primary-action" role="button" aria-controls="completion"' + (primaryControlMode === 'disabled' ? ' aria-disabled="true"' : '') + '>Get started</div>'
          : '<a id="primary-action" aria-controls="completion" href="/primary-control-target">Get started</a>'
      res.end('<!doctype html><html lang="en"><head><title>Useful service for teams</title></head><body><main><h1>Useful service for teams</h1><p>Choose your next step.</p>' +
        (primaryControlMode === 'missing' ? '' : control) + '<div id="completion" hidden role="dialog" aria-label="Next step"><h2>Choose your next step</h2></div>' +
        '<script>document.getElementById("primary-action")?.addEventListener("click",event=>{event.preventDefault();' +
        (primaryControlMode === 'healthy' ? 'document.getElementById("completion").hidden=false;' : '') + '});</script></main></body></html>')
    } else if (req.url === '/primary-action') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Useful website service for teams</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body><main><h1>Useful website service for teams</h1><p>Get useful information about our service and choose the next step.</p>' +
        (primaryActionMode === 'competing' ? '<a id="other-action" href="/unrelated-action-target">Get started</a>' : '') +
        (primaryActionMode === 'removed' ? '' : '<a id="primary-action" href="' + (primaryActionMode === 'changed' ? '/unrelated-action-target' : '/primary-action-target?token=PRIVATE_ACTION_VALUE') + '">Get started</a>') +
        '</main></body></html>')
    } else if (req.url?.split('?')[0] === '/primary-action-target' || req.url === '/unrelated-action-target') {
      const healthy = primaryActionMode === 'healthy' || req.url === '/unrelated-action-target'
      res.statusCode = healthy || primaryActionMode === 'challenge' ? 200 : primaryActionMode === 'blocked' ? 429 : 404
      if (primaryActionMode === 'challenge' && !healthy) res.setHeader('cf-mitigated', 'challenge')
      res.setHeader('content-type', 'text/html')
      const label = primaryActionMode === 'challenge' && !healthy ? 'Just a moment...' : healthy ? 'Choose your next step' : 'This page is unavailable'
      res.end('<!doctype html><html lang="en"><head><title>' + label + '</title></head><body><main><h1>' + label + '</h1>' +
        (healthy ? '<a href="/primary-action">Review service details</a>' : '') + '</main></body></html>')
    } else if (req.url === '/sections' || req.url === '/sections-peer') {
      const peer = req.url === '/sections-peer'
      if (sectionLinksMode === 'challenge') res.setHeader('cf-mitigated', 'challenge')
      res.setHeader('content-type', 'text/html')
      const target = peer ? 'café' : 'Pricing', repaired = sectionLinksMode === 'healthy' || sectionLinksMode === 'partial' && !peer
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + (sectionLinksMode === 'challenge' ? 'Just a moment...' : 'Useful service sections') + '</title></head>' +
        '<body><main><h1>Useful service sections</h1>' +
        (sectionLinksMode === 'removed' ? '' : '<a href="#' + (sectionLinksMode === 'changed' ? 'other' : encodeURIComponent(target)) + '">Section details</a>') +
        '<section id="' + (repaired ? target : 'other') + '"><h2>Section details</h2></section>' +
        '<a href="#Help%20center">Help</a><section id="Help center">Help information</section>' +
        '<a href="#Contact">Contact</a><a name="Contact">Contact information</a>' +
        (peer ? '' : '<a href="/sections-peer">Other information</a>') + '</main></body></html>')
    } else if (req.url === '/public-links' || req.url === '/public-links-peer') {
      const peer = req.url === '/public-links-peer'
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Public link fixture</title></head><body><main><h1>Public link fixture</h1>' +
        (publicLinksMode === 'removed' ? '' : '<a href="' + (peer ? '/public-links-other-gone' : '/public-links-gone') + '">Useful details</a>') +
        (peer ? '' : '<a href="/public-links-peer">Other information</a>') + '</main></body></html>')
    } else if (req.url === '/public-links-gone' || req.url === '/public-links-other-gone') {
      res.statusCode = publicLinksMode === 'healthy' ? 200 : publicLinksMode === 'blocked' ? 429 : 404
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html><head><title>' + (publicLinksMode === 'healthy' ? 'Useful details' : 'Unavailable page') + '</title></head><body><h1>Useful details</h1></body></html>')
    } else if (req.url === '/accessibility' || req.url === '/accessibility-linked') {
      const linked = req.url === '/accessibility-linked', names = linked ? accessibilityOtherNames : accessibilityNames
      if (linked && accessibilityOtherUnavailable) res.statusCode = 503
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Accessibility fixture</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>body{background:white;color:black;font-family:Arial}button{width:100px;height:40px}p{font-size:16px}</style></head><body><main><h1>Accessibility fixture</h1>' +
        '<button id="submit"' + (names ? ' aria-label="Submit"' : '') + '><svg aria-hidden="true" width="10" height="10"><rect width="10" height="10"/></svg></button>' +
        '<label' + (names ? ' for="email"' : '') + '>Email</label><input id="email" type="email">' +
        '<iframe id="embed"' + (names ? ' title="Example embedded information"' : '') + ' srcdoc="&lt;html&gt;&lt;body&gt;&lt;p&gt;Embedded information&lt;/p&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>' +
        '<div' + (accessibilityAria ? '' : ' aria-hidden="true"') + '><button id="hidden-action">Hidden action</button></div>' +
        (linked ? '' : '<p id="contrast" style="color:' + (accessibilityContrast ? '#111' : '#bbb') + ';background:' +
          (accessibilityUncertain ? 'linear-gradient(90deg,white,black)' : 'white') + '">Useful service information</p>') +
        '<a href="/accessibility-linked">Details</a></main></body></html>')
    } else if (req.url === '/console' || req.url === '/console-linked' || req.url === '/console-redirect') {
      const mobile = /Mobile/i.test(req.headers['user-agent'] ?? '')
      if (consoleRedirected && req.url === '/console') {
        res.setHeader('content-type', 'text/html')
        res.end('<!doctype html><html><head><title>Redirect fixture</title><script>setTimeout(()=>location.replace("/console-redirect"),' + consoleRedirectDelayMs + ')</script></head><body>Redirecting</body></html>')
        return
      }
      if (consoleDesktopUnavailable && !mobile || consoleMobileUnavailable && mobile && req.url === '/console-linked') res.statusCode = 503
      res.setHeader('content-type', 'text/html')
      const count = req.url === '/console-linked' ? consoleLinkedErrors : consoleRootErrors
      const script = consoleFlood ? 'for(let i=0;i<505;i++)console.error("Flood "+i);console.error("' + 'x'.repeat(2100) + 'first");console.error("' + 'x'.repeat(2100) + 'second");'
        : 'setTimeout(()=>{' + Array.from({ length: Math.max(0, count - 1) }, (_, index) => 'console.error("Console failure ' + index + '");').join('') +
          (count ? 'throw new Error("Unhandled page failure")' : '') + '},' + consoleDelayMs + ');'
      res.end('<!doctype html><html lang="en"><head><title>Console fixture</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '</head><body><main><h1>Console fixture</h1><a href="/console-linked">Details</a><script>' + script + '</script></main></body></html>')
    } else if (req.url === '/trust') {
      res.setHeader('content-type', 'text/html')
      if (trustUnavailable) res.statusCode = 503
      res.end('<!doctype html><html lang="en"><head><title>Public trust fixture | Useful website information</title>' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"><script>' +
        (trustAnalytics ? 'window.gtag=function(){};gtag("config","G-LOCAL123");' : '') +
        (trustConsoleErrors ? 'console.error("Unrelated first error");console.error("Unrelated second error");console.error("Unrelated third error");' : '') +
        '</script></head><body><main><h1>Useful website information</h1><p>Read useful information about our services.</p>' +
        (trustPrivacy ? '<a href="/privacy">Privacy policy</a>' : '') + (trustContact ? '<a href="mailto:help@example.com">Email support</a>' : '') +
        (trustConsent ? '<aside id="cookie-settings">Cookie settings</aside>' : '') + '</main></body></html>')
    } else if (req.url === '/monitored') {
      if (monitoredUnavailable) res.statusCode = 503
      if (monitoredChallenge === 'header') res.setHeader('cf-mitigated', 'challenge')
      res.setHeader('content-type', 'text/html')
      for (const [key, value] of Object.entries(healthyHeaders)) res.setHeader(key, value)
      res.end('<!doctype html><html lang="en"><head>' + (monitoredChallenge === 'title' ? '<title>Just a moment...</title>' : monitoredTitleMissing ? '' : '<title>Monitored website | Useful public information</title>') +
        '<meta name="description" content="Useful public information about the monitored website, with clear navigation and accessible customer information.">' +
        '<link rel="canonical" href="' + origin + '/monitored"></head><body><main><h1>Useful public information</h1>' +
        '<p>Read the information you need about this website and its services.</p><a href="#details">Learn more</a>' +
        '<section id="details"><h2>Helpful details</h2><p>Clear information for everyone using this website.</p></section></main></body></html>')
    } else if (req.url === '/headers' || req.url === '/headers-other') {
      if (headerMode === 'redirected' && req.url === '/headers') {
        res.writeHead(302, { location: origin + '/headers-other' }); res.end(); return
      }
      res.setHeader('content-type', 'text/html')
      if (headerMode !== 'failed') for (const [key, value] of Object.entries(healthyHeaders)) res.setHeader(key, value)
      if (headerMode === 'partial') res.setHeader('strict-transport-security', 'max-age=60; includeSubDomains; preload')
      if (headerMode === 'challenge') res.setHeader('cf-mitigated', 'challenge')
      res.end('<!doctype html><html><head>' + (headerTitleMissing ? '' : '<title>Header fixture</title>') + '</head><body><h1>Header fixture</h1></body></html>')
    } else if (req.url === '/public-form-submission') {
      publicFormSubmissions++
      res.end('This endpoint must not receive a public validation probe.')
    } else if (req.url === '/public-form') {
      const mode = publicFormMode
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Public form fixture</title></head><body><main><h1>Public form fixture</h1>' +
        (mode === 'unrelated' || mode === 'hidden' ? '<form id="other"><label>Other email<input name="other" required></label><button>Other form</button></form>' : '') +
        '<form id="primary"' + (mode === 'hidden' ? ' hidden' : '') + '><label>Email<input name="email" aria-required="true"' +
        (mode === 'native' ? ' required' : '') + (mode === 'prefilled' ? ' value="PRIVATE_FORM_VALUE@example.test"' : '') +
        '></label><button type="submit">Subscribe</button><p role="alert" id="error" hidden></p></form>' +
        '<script>const form=document.getElementById("primary"),mode=' + JSON.stringify(mode) + ';window.validationCalls=0;' +
        'form.onsubmit=e=>{if(e.defaultPrevented)return;window.validationCalls++;e.preventDefault();' +
        'if(mode==="blocked")fetch("/public-form-submission",{method:"POST",body:"unauthorized"}).catch(()=>{});' +
        'if(mode==="socket")new WebSocket("wss://example.com/public-form-submission");' +
        'if(mode==="peer")new RTCPeerConnection();if(mode==="popup")window.open("/public-form-submission");' +
        'if(mode==="outside")setTimeout(()=>{const p=document.createElement("p");p.setAttribute("role","alert");p.textContent="Error outside the form";document.body.append(p)},100);' +
        'if(mode==="slow"||mode==="healthy")setTimeout(()=>{const p=document.getElementById("error");p.hidden=false;p.textContent="Email is required"},mode==="slow"?1400:100)};</script>' +
        '</main></body></html>')
    } else if (req.url?.startsWith('/pagespeed-fixture')) {
      const failed = pageSpeedMode === 'failed'
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ lighthouseResult: { categories: { performance: { score: failed ? 0.35 : 0.95 } }, audits: {
        'largest-contentful-paint': { numericValue: 1000 }, 'cumulative-layout-shift': { numericValue: 0 },
        'first-contentful-paint': { numericValue: 500 }, 'total-blocking-time': { numericValue: 0 },
        ...(pageSpeedMode === 'missing' ? {} : {
          'render-blocking-insight': { score: failed ? 0 : 1, metricSavings: { FCP: failed ? 900 : 0 } },
          'unused-javascript': { score: failed ? 0 : 1, details: { overallSavingsBytes: failed ? 200_000 : 0 } },
          'unused-css-rules': { score: failed ? 0 : 1, details: { overallSavingsBytes: failed ? 80_000 : 0 } },
          'image-delivery-insight': { score: failed ? 0 : 1, details: { debugData: { wastedBytes: failed ? 150_000 : 0 } } },
        }),
      } } }))
    } else if (req.url === '/robots.txt') {
      res.setHeader('content-type', 'text/plain')
      res.end('User-agent: *\nDisallow: /private\nSitemap: ' + origin + '/sitemap.xml')
    } else if (req.url === '/sitemap.xml') {
      res.setHeader('content-type', 'application/xml')
      res.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>')
    } else if (req.url === '/signup-reset' || req.url === '/signup-cleanup') {
      let body = ''
      for await (const chunk of req) body += chunk
      const operationId = (JSON.parse(body) as { operationId?: string }).operationId
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: req.url === '/signup-reset' || signupCleanupOk, operationId, settled: signupCleanupOk }))
    } else if (req.url === '/signup-submit') {
      expect(req.method).toBe('POST')
      signupSubmissions++
      for await (const chunk of req) void chunk
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: signupMode === 'success' }))
    } else if (req.url === '/signup-flow') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Signup fixture</title></head><body><main><h1>Signup fixture</h1>' +
        '<form><label>Email<input name="email" type="email"></label><button>Sign up</button></form>' +
        '<p id="completion"' + (signupMode === 'preexisting' ? '' : ' hidden') + '>Check your inbox</p>' +
        '<script>document.querySelector("form").onsubmit=async e=>{e.preventDefault();const r=await fetch("/signup-submit",' +
        '{method:"POST",body:new FormData(e.target)});const result=await r.json();if(result.ok)setTimeout(()=>{document.getElementById("completion").hidden=false},250)}</script>' +
        '</main></body></html>')
    } else if (req.url === '/cleanup') {
      let body = ''
      for await (const chunk of req) body += chunk
      const operationId = (JSON.parse(body) as { operationId: string }).operationId
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, operationId, settled: false }))
    } else if (req.url === '/canonical') {
      res.writeHead(404); res.end('Missing canonical destination')
    } else if (req.url?.startsWith('/_vercel/insights/script.js')) {
      res.setHeader('content-type', 'application/javascript')
      res.writeHead(trackingRepaired ? 200 : 503)
      res.end(trackingRepaired ? 'navigator.sendBeacon("/_vercel/insights/view", "PRIVATE_TRACKING_PAYLOAD")' : 'Library unavailable')
    } else if (['/checkout-destination', '/login-destination', '/preview.png'].includes(req.url ?? '')) {
      res.setHeader('content-type', req.url === '/preview.png' ? 'image/png' : 'text/html')
      res.writeHead(req.method === 'HEAD' || destinationsRepaired ? 200 : 404)
      res.end(destinationsRepaired && req.url === '/preview.png'
        ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTwsAAAAASUVORK5CYII=', 'base64')
        : destinationsRepaired ? 'Available destination' : 'Missing destination')
    } else if (req.url === '/destinations') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Destination fixture</title><meta property="og:image" content="/preview.png"></head>' +
        '<body><main><h1>Destination fixture</h1><a href="' + destinationOrigin + '/checkout-destination">Subscribe</a><a href="' + destinationOrigin + '/login-destination">Log in</a></main></body></html>')
    } else if (req.url === '/tracking') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Tracking fixture</title><script src="/_vercel/insights/script.js"></script></head>' +
        '<body><main><h1>Tracking fixture</h1><a href="#details" onclick="const s=document.createElement(\'script\');s.src=\'/_vercel/insights/script.js?phase=action\';document.head.append(s)">Get started</a><section id="details">Useful details</section></main></body></html>')
    } else if (req.url === '/keyboard') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Keyboard fixture</title><style>#first:focus-visible,#second:focus-visible {' +
        (focusRepaired ? 'outline:3px solid blue;outline-offset:2px' : 'outline:none;box-shadow:none') +
        '}</style></head><body><main><h1>Keyboard fixture</h1><button id="first">First</button><button id="second">Second</button>' +
        '<button id="options" aria-haspopup="menu" aria-controls="menu">Options</button><div role="menu" id="menu" hidden>' +
        '<button role="menuitem" tabindex="-1" id="item-one">One</button><button role="menuitem" tabindex="-1" id="item-two">Two</button></div>' +
        '<script>const t=document.getElementById("options"),m=document.getElementById("menu"),items=[...m.querySelectorAll("button")];' +
        't.onclick=()=>{m.hidden=false;items[0].focus()};m.onkeydown=e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp")' +
        '{e.preventDefault();items[(items.indexOf(document.activeElement)+1)%2].focus()};if(e.key==="Escape"){m.hidden=true;' +
        (restorationRepaired ? 't.focus()' : 'document.activeElement.blur()') + '}}</script></main></body></html>')
    } else {
      res.setHeader('content-type', 'text/html')
      if (req.url === '/') res.statusCode = availabilityStatus
      if (req.url === '/independent-page') res.statusCode = otherAvailabilityStatus
      if (availabilityChallenged && req.url === '/') res.setHeader('cf-mitigated', 'challenge')
      res.end('<!doctype html><html lang="en"><head><title>Execution fixture</title><link rel="canonical" href="/canonical"></head><body><main><h1>Execution fixture</h1></main><footer>Cloudflare and CAPTCHA resources</footer></body></html>')
    }
  })
  let worker: ReturnType<typeof startWorker> | undefined

  function fixtureTransport() {
    const originalSession = pageSessions.createAuditPage
    return vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => originalSession(browser, url, {
      ...options, configurePage: async page => {
        // Serve controlled HTML through real Chromium. Retain the production
        // mutation guard rather than granting the fixture implicit submission consent.
        await page.route(origin + '/**', async route => {
          if (classifyTrackingEndpoint(route.request().url(), route.request().resourceType(), origin)?.role === 'event') return route.fallback()
          const fulfill = async () => {
            const request = route.request()
            const response = await fetch(request.url(), { method: request.method(), body: request.postDataBuffer() ?? undefined, redirect: 'manual',
              headers: { 'user-agent': request.headers()['user-agent'] ?? '',
                ...(request.method() === 'POST' ? { 'content-type': request.headers()['content-type'] ?? 'application/json' } : {}) } })
            await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() })
          }
          if (options.journeySafe || options.buyPath) await applyJourneyRouteGuards(route, fulfill)
          else await fulfill()
        })
        // The fixture's own authorization and request guard runs before transport.
        await options.configurePage?.(page)
      },
    }))
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use scripts/verify-progressive-execution.mjs to create disposable execution resources')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    const nativeFetch = globalThis.fetch
    // Only transport is replaced. Public URL validation, HTTP/body collection,
    // task ownership, queues, evaluator threads and database projections are real.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'www.googleapis.com' && url.pathname === '/pagespeedonline/v5/runPagespeed' && pageSpeedMode)
        return nativeFetch(`http://127.0.0.1:${address.port}/pagespeed-fixture?strategy=${url.searchParams.get('strategy')}`, init)
      if (![origin, destinationOrigin].includes(url.origin)) throw new Error('External service unavailable in this fixture')
      return nativeFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, init)
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Execution fixture', url: origin + '/', canonicalHost: 'example.com' } })
    await getAuditTaskQueue('browser').pause()
    await getAuditTaskQueue('provider').pause()
    await getAuditBrowser()
    worker = startWorker()
    await worker.waitUntilReady()
  })

  afterAll(async () => {
    releaseResources()
    await worker?.close()
    await clearWorkerHeartbeat()
    await closeBrowser()
    for (const queue of [getAuditQueue(), ...(['http', 'browser', 'provider', 'evaluate', 'availability'] as const).map(getAuditTaskQueue)]) {
      const client = await queue.client
      await queue.close()
      client.disconnect()
    }
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('reads the execution ledger from the fully migrated disposable database', async () => {
    const url = new URL(process.env.DATABASE_URL!)
    expect(['localhost', '127.0.0.1']).toContain(url.hostname)
    expect(url.pathname).toMatch(/^\/fixflags_execution_test_[a-f0-9]{32}$/)
    expect(await prisma.auditVerifierExecution.count()).toBe(0)
    expect(await prisma.auditPipelineEvent.count()).toBe(0)
  })

  it('publishes independent Search results before slow resources and finalizes honest partial coverage', async () => {
    const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'progressive-search' })
    const replay = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'progressive-search' })
    expect(replay).toMatchObject({ runId: admitted.runId, auditId: admitted.auditId, reused: true })
    const auditId = admitted.auditId!
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search-crawl' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 })
    expect(requests).toContain('/robots.txt')
    expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ dispatchState: 'SENT', status: 'CHECKING' })
    expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:resources' } })).toMatchObject({ workState: 'RUNNING' })
    expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search' } })).toMatchObject({ workState: 'WAITING' })
    expect(await getOwnedRun(userId, admitted.runId)).toMatchObject({ scope: 'SITE', result: null, completionState: 'PENDING' })
    // Model terminally unavailable dependencies while retaining the actual
    // collector and evaluator results. No successful browser input is invented.
    await prisma.auditVerifierExecution.updateMany({ where: { auditId, workKind: { in: ['browser', 'keyboard', 'captures', 'pagespeed', 'google'] } },
      data: { workRecoveryUntil: new Date(0) } })
    await dispatchReadyTasks(await reconcileTasks(auditId))
    await getAuditTaskQueue('browser').resume()
    await getAuditTaskQueue('provider').resume()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search-presentation' } })).toMatchObject({ workState: 'COMPLETED' })
      expect(await prisma.flag.count({ where: { auditId } })).toBeGreaterThan(0)
    }, { timeout: 15_000, interval: 100 })
    const early = await loadSiteHome(projectId)
    expect(early).not.toBeNull()
    releaseResources()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 }).catch(async error => {
      console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
        select: { targetKey: true, workState: true, workErrorCode: true } }))
      throw error
    })
    expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ status: 'COMPLETED', reportCompleteness: 'PARTIAL' })
    const summary = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'task:p0:search' } })
    const receipt = searchArtifactSchema.parse(readArtifact(summary.workResult, 'search').data).receipt
    expect(receipt.complete).toBe(false)
    expect(receipt.observations.some(item => item.disposition === 'unknown')).toBe(true)
    expect(await prisma.auditVerifierExecution.count({ where: { auditId, targetKey: { in: SEARCH_LOCAL_MODULES } } })).toBe(6)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId, event: 'task_observation_committed' } })).toBeGreaterThan(6)
    const home = await loadSiteHome(projectId)
    const summaryView = (await loadSiteSummaries(userId)).find(site => site.id === projectId)!
    expect(home!.cards.find(card => card.id === 'search')?.incompleteReason).toBeTruthy()
    expect(home!.presentation.result.state).not.toBe('clear')
    const runView = await getOwnedRun(userId, admitted.runId)
    expect(runView).toMatchObject({ scope: 'SITE', status: 'COMPLETED', completionState: 'PARTIAL', coverage: { completeness: 'PARTIAL' } })
    expect(['FLAG', 'COULD_NOT_VERIFY']).toContain(runView!.result)
    expect(runView!.summary).toBeTruthy()
    expect(runView!.coverage.gaps.length).toBeGreaterThan(0)
    expect(runView!.result === 'FLAG').toBe(home!.presentation.result.state === 'flags')
    expect(summaryView.presentation.result).toEqual(home!.presentation.result)
    expect(home!.presentation.run).toMatchObject({ state: 'partial', recoveryAction: 'retry' })
    expect(summaryView.presentation.run).toEqual(home!.presentation.run)
    expect(home!.monitoringTrend.find(entry => entry.id === auditId)?.completionState).toBe('PARTIAL')
  })

  it('rechecks categories on the real ledger without replacing full-site analysis or resolving unrelated Flags', async () => {
    releaseResources()
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      headerMode = 'failed'
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/headers', idempotencyKey: 'category-source' })
      await vi.waitFor(async () => {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: source.auditId!,
          workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] }, workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(source.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: source.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 250 })
      const securityFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'security-headers-missing' } })
      const searchFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'description-missing' } })
      async function recheck(area: 'search' | 'security', key: string) {
        const admitted = await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: area, outcomeIds: [], source: 'WEB', idempotencyKey: key })
        expect(await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: area, outcomeIds: [], source: 'WEB', idempotencyKey: key }))
          .toMatchObject({ runId: admitted.runId, auditId: admitted.auditId, reused: true })
        await vi.waitFor(async () => {
          await dispatchReadyTasks(await reconcileTasks(admitted.auditId!))
          expect(await prisma.audit.findUnique({ where: { id: admitted.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 25_000, interval: 250 })
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })
        expect(readExecutionSpec(audit.executionSpec)).toMatchObject({ scope: 'CATEGORY', targetUrl: origin + '/headers', category: { area, sourceAuditId: source.auditId } })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.id, workKind: { not: null } } })
        expect(tasks.some(task => ['captures', 'judge', 'discovery', 'pagespeed', 'slow-replay', 'journeys'].includes(task.workKind!))).toBe(false)
        const runView = await getOwnedRun(userId, admitted.runId)
        expect(runView).toMatchObject({ scope: 'CATEGORY', area, status: 'COMPLETED', result: expect.any(String) })
        const home = (await loadSiteHome(projectId))!
        expect(home.audit.id).toBe(source.auditId)
        expect(home.monitoringTrend.some(entry => entry.id === audit.id)).toBe(false)
        expect(home.monitoringHistory.find(entry => entry.id === audit.id)).toMatchObject({ scope: 'CATEGORY', targetLabel: area === 'search' ? 'Search' : 'Security', result: runView!.result })
        expect(home.cards.find(card => card.id === area)?.checkedAt).toBeTruthy()
        expect((await loadSiteSummaries(userId)).find(site => site.id === projectId)?.presentation.result).toEqual(home.presentation.result)
        return admitted
      }
      await recheck('search', 'category-search')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: securityFlag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      headerMode = 'healthy'
      const repair = await recheck('security', 'category-security-repaired')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: securityFlag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repair.auditId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: searchFlag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      headerMode = 'failed'
      const recurrence = await recheck('security', 'category-security-recurrence')
      expect(await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: securityFlag.checkId } })).toMatchObject({ status: 'REGRESSED' })
    } finally { headerMode = 'failed'; transport.mockRestore() }
  }, 100_000)

  it('recovers an unacted customer incident across all original occurrences and preserves recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport()
    headerTitleMissing = true
    try {
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      async function settledRun(scope: 'SITE' | 'CATEGORY', key: string) {
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope,
          ...(scope === 'SITE' ? { url: origin + '/headers' } : { categoryArea: 'search' as const }), idempotencyKey: key })
        await vi.waitFor(async () => {
          await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!,
            workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] },
            workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(run.auditId!))
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 250 })
        return run
      }
      const first = await settledRun('SITE', 'incident-original')
      const second = await settledRun('SITE', 'incident-observed-again')
      const original = await prisma.flag.findFirstOrThrow({ where: { auditId: first.auditId!, checkId: 'title-missing' },
        include: { improvementOccurrence: true } })
      const improvementId = original.improvementOccurrence!.improvementId
      const current = await loadSiteFlags((await loadSiteRecord(projectId))!)
      expect(current.filter(flag => flag.checkId === 'title-missing')).toHaveLength(1)
      headerTitleMissing = false
      const repair = await settledRun('CATEGORY', 'incident-independent-recovery')
      const originals = await prisma.flag.findMany({ where: { auditId: { in: [first.auditId!, second.auditId!] }, checkId: 'title-missing' } })
      expect(originals).toHaveLength(2)
      expect(originals.every(flag => flag.status === 'FIXED' && flag.resolvedInId === repair.auditId)).toBe(true)
      expect(await prisma.improvement.findUnique({ where: { id: improvementId } })).toMatchObject({ status: 'PROPOSED' })
      expect(await prisma.improvementAttempt.count({ where: { improvementId } })).toBe(0)
      const home = (await loadSiteHome(projectId))!
      expect(home.audit.id).toBe(second.auditId)
      expect(home.flags.some(flag => flag.checkId === 'title-missing')).toBe(false)
      expect(home.resolvedFlags.filter(flag => flag.checkId === 'title-missing')).toHaveLength(1)
      expect(home.resolvedFlags.find(flag => flag.checkId === 'title-missing')?.id).toBe(improvementId)
      const repairedRun = await getOwnedRun(userId, repair.runId)
      const comparison = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repair.auditId!, targetKey: 'projection:flag-comparison' }, select: { detail: true } })
      expect(repairedRun?.result, JSON.stringify(comparison.detail)).not.toBe('FLAG')
      expect((await loadSiteSummaries(userId)).find(site => site.id === projectId)?.presentation.result).toEqual(home.presentation.result)
      headerTitleMissing = true
      const recurrence = await settledRun('CATEGORY', 'incident-recurrence')
      expect(await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'title-missing' } })).toMatchObject({ status: 'REGRESSED' })
      expect((await loadSiteFlags((await loadSiteRecord(projectId))!)).find(flag => flag.checkId === 'title-missing'))
        .toMatchObject({ id: improvementId, verificationState: 'regressed' })
      expect(await prisma.improvementAttempt.count({ where: { improvementId } })).toBe(0)
    } finally { headerTitleMissing = false; transport.mockRestore() }
  }, 100_000)

  it('fences an interrupted Signup owner and refuses replay until exact-operation cleanup is settled', async () => {
    await getAuditTaskQueue('browser').pause()
    const fixture = await prisma.outcomeFixture.create({ data: { projectId, name: 'Signup fixture', targetUrl: origin + '/signup',
      fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Sign up' } },
      encryptedValues: encryptSecret(JSON.stringify({ email: 'synthetic@example.test' })),
      successCriterion: { type: 'text', value: 'Check your inbox' }, resetUrl: origin + '/reset', cleanupUrl: origin + '/cleanup',
      authorizedAt: new Date(), lastDryRunVersion: 1, lastDryRunResult: { disposition: 'SUCCEEDED', reason: 'previous', detail: { fieldCount: 1, cleanupStatus: 'succeeded' } } } })
    const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'FIXTURE_SETUP', fixtureId: fixture.id, idempotencyKey: 'signup-setup' })
    const auditId = admitted.auditId!
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'fixture-setup' } })).not.toBeNull()
    }, { timeout: 10_000, interval: 100 })
    expect(await prisma.outcomeFixture.findUnique({ where: { id: fixture.id } })).toMatchObject({ authorizedAt: null, lastDryRunVersion: null })
    const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, workKind: 'fixture-setup' } })
    const owner = { auditId, taskId: task.id, token: 'interrupted-owner', generation: 1 }
    const operationId = task.id + ':g1'
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workState: 'RUNNING', status: 'RUNNING',
      workToken: owner.token, workGeneration: 1, workAttempts: 1, workLeaseUntil: new Date(Date.now() + 90_000) } })
    await withExecutionOwnership(owner, async () => {
      await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId: operationId, traceId: auditId,
        attempt: 1, stage: 'checking', status: 'started', event: 'protected_submission_admitted',
        detail: { operationId, fixtureId: fixture.id, fixtureVersion: fixture.version } } }))
    })
    await expect(withExecutionOwnership(owner, () => executionWrite(tx => tx.outcomeFixture.update({ where: { id: fixture.id },
      data: { authorizedAt: new Date() } })))).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    await reconcileTasks(auditId)
    expect(await prisma.auditVerifierExecution.findUnique({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'WORKER_INTERRUPTED' })
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    await dispatchReadyTasks(await reconcileTasks(auditId))
    await getAuditTaskQueue('browser').resume()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findUnique({ where: { id: task.id } })).toMatchObject({ workState: 'BLOCKED',
        workGeneration: 2, workErrorCode: 'PROTECTED_EFFECT_UNRESOLVED' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 })
    expect(requests).toContain('/cleanup')
    expect(requests).not.toContain('/reset')
    expect(requests).not.toContain('/signup')
    expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'FAILED' })
    expect((await listOutcomeFixtures(projectId))[0]).toMatchObject({ authorizedAt: null, lastDryRunResult: { disposition: 'BLOCKED', detail: { cleanupStatus: 'unknown' } } })
    await expect(authorizeOutcomeFixture(projectId, fixture.id)).rejects.toMatchObject({ code: 'FIXTURE_DRY_RUN_REQUIRED' })
    const site = await loadSiteHome(projectId)
    expect(site).not.toBeNull()
    expect(site!.audit.id).not.toBe(auditId)
  })

  it('collects a real keyboard failure and verifies the repaired controls through targeted application admission', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause()
      await getAuditTaskQueue('provider').pause()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/keyboard', idempotencyKey: 'keyboard-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'keyboard' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['browser', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume()
      await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'focus-visible-missing' } })
      expect(flag).toMatchObject({ source: 'DETERMINISTIC', pageUrl: origin + '/keyboard',
        evidenceTargets: [{ selector: '#first', source: 'measured' }, { selector: '#second', source: 'measured' }] })
      expect(flag.fix).toContain(':focus-visible')
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'keyboard-fix',
        changeSummary: 'Restore the focus outline on the two reported controls' })
      focusRepaired = true
      const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'keyboard-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'keyboard'])
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:focus-visible-missing' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'keyboard',
        assertion: { targets: [{ selector: '#first', label: 'First' }, { selector: '#second', label: 'Second' }] } })
      expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
        improvementId: expect.any(String) })
      expect(await getOwnedRun(userId, verified.runId)).toMatchObject({ scope: 'DIAGNOSTIC', result: 'CLEAR',
        completionState: 'FULL', summary: 'This verification confirmed recovery under the recorded failure conditions.' })
      const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'module:keyboard' } })
      const observed = projectCheckResults(verified.auditId!, [receipt])
      expect(observed.filter(result => result.name === 'Focus indicators on exercised controls').every(result => result.status === 'passed')).toBe(true)
      expect(observed.find(result => result.name === 'Options: Focus after dismissal')?.status).toBe('findings')
      expect(observed.find(result => result.kind === 'execution')?.status).toBe('unknown')

      const popupFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'keyboard-focus-restoration' } })
      expect(popupFlag.evidenceTargets).toMatchObject([{ selector: '#options', context: 'menu:#options=>#menu' }])
      const popupFix = await recordSiteFlagFix({ siteId: projectId, flagId: popupFlag.id, userId,
        idempotencyKey: 'popup-fix', changeSummary: 'Restore focus to Options after dismissing the menu' })
      restorationRepaired = true
      const popupVerified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'popup-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: popupFlag.pageUrl!, checkId: popupFlag.checkId!, attemptId: popupFix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: popupVerified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const popupTasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: popupVerified.auditId!, workKind: { not: null } } })
      expect(popupTasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'keyboard'])
      const popupProof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: popupVerified.auditId!, targetKey: 'check:keyboard-focus-restoration' } })
      expect(checkVerifierSchema.parse(popupProof.detail)).toMatchObject({ verdict: 'passed', source: 'keyboard',
        assertion: { targets: [{ selector: '#options', label: 'Options', context: 'menu:#options=>#menu' }] } })
      expect(await prisma.improvementAttempt.findUnique({ where: { id: popupFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    } finally { transport.mockRestore() }
  })
  it('observes Tracking library failures in loading and the public walk, then verifies both repaired scopes without delivering events', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await getAuditTaskQueue('provider').pause()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/tracking', idempotencyKey: 'tracking-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'browser' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      const walk = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: beforeId, targetKey: 'task:p0:flow' } })
      expect(walk).toMatchObject({ workState: 'COMPLETED' })
      expect((readArtifact(walk.workResult, 'flow').data as { tracking: { requests: unknown[] } }).tracking.requests).toMatchObject([{ role: 'library', status: 503 }])
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'tracking-library-http-error' } })
      const targets = flag.evidenceTargets as Array<{ context: string }>
      expect(targets.some(target => target.context.startsWith('tracking:page_load:'))).toBe(true)
      expect(targets.some(target => target.context.startsWith('tracking:public_action:'))).toBe(true)
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'tracking-fix', changeSummary: 'Restore the requested tracking library endpoint' })
      trackingRepaired = true
      const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'tracking-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize', 'flow'])
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:tracking-library-http-error' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'browser-network' })
      expect((proof.evidenceReference as { supportingTasks: unknown[] }).supportingTasks).toHaveLength(2)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, targetKey: 'module:measurement' } })
      const results = projectCheckResults(verified.auditId!, receipts)
      expect(results.some(result => result.assertionKey === 'tracking-initiation' && result.status === 'observed')).toBe(true)
      expect(results.filter(result => result.assertionKey === 'tracking-http-response' || result.assertionKey === 'tracking-provider-recording').every(result => result.status === 'unknown')).toBe(true)
      expect(JSON.stringify(receipts)).not.toContain('PRIVATE_TRACKING_PAYLOAD')
      expect(requests.some(path => path.startsWith('/_vercel/insights/view'))).toBe(false)
      const site = await loadSiteHome(projectId)
      expect(site!.cards.find(card => card.id === 'tracking')?.state).not.toBe('healthy')
    } finally { transport.mockRestore() }
  })

  it('verifies checkout, sign-in and preview-image repairs through the real application, queue and worker', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await getAuditTaskQueue('provider').pause()
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/destinations', idempotencyKey: 'destination-source' })
      const beforeId = source.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'browser' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      // These unrelated responsibilities are deliberately unavailable in this fixture.
      // The actual browser collector, destination evaluators and publication still run.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 }).catch(async error => {
        console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId: beforeId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
          select: { targetKey: true, workState: true, workErrorCode: true } }))
        throw error
      })
      destinationsRepaired = true
      for (const checkId of ['checkout-link-dead', 'auth-page-broken', 'og-image-broken']) {
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId } })
        expect(flag.evidenceTargets).toMatchObject([{ kind: 'page', context: expect.stringMatching(/^destination:/) }])
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: checkId + '-fix',
          changeSummary: 'Restore the original public destination' })
        const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: checkId + '-verification',
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:' + checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', assertion: { complete: true } })
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.auditId })
      }
    } finally { transport.mockRestore() }
  }, 60_000)

  it('records public link evidence during discovery and independently verifies its exact repair through the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/public-links'
    try {
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      async function completeBroad(auditId: string) {
        await vi.waitFor(async () => {
          // Optional provider and capture capability is intentionally unavailable.
          // HTTP, browser discovery and link evidence execute normally, including
          // pages added by the discovery graph rather than only its initial tasks.
          await prisma.auditVerifierExecution.updateMany({ where: { auditId,
            workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] }, workState: { not: 'COMPLETED' } },
            data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(auditId))
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: 25_000, interval: 250 })
      }
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: pageUrl, idempotencyKey: 'public-links-source' })
      await completeBroad(source.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'broken-internal-links' } })
      expect(flag.affectedPaths).toEqual([pageUrl, origin + '/public-links-peer'])
      expect(flag.evidenceTargets).toHaveLength(2)
      expect(flag.evidenceTargets).toMatchObject([{ context: expect.stringMatching(/^destination:/) }, { context: expect.stringMatching(/^destination:/) }])
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: source.auditId!, targetKey: 'module:seo', scopeKey: { contains: 'public-links:first' } } }))
        .toMatchObject({ status: 'COMPLETED', detail: { execution: { source: 'http' } } })
      async function verify(phase: string) {
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'public-links-fix:' + phase,
          changeSummary: 'Restore the original public destination' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'public-links-verify:' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: 'broken-internal-links', parentAuditId: source.auditId!, attemptId: fix.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, workKind: { not: null } } })).map(task => task.workKind).sort())
          .toEqual(['browser', 'browser', 'check', 'check', 'finalize'])
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      expect((await verify('unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      publicLinksMode = 'blocked'
      expect((await verify('blocked')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      publicLinksMode = 'removed'
      expect((await verify('removed')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      publicLinksMode = 'healthy'
      const repaired = await verify('repaired')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.auditId })
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.run.auditId!, targetKey: 'check:broken-internal-links' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http' })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      publicLinksMode = 'failed'
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', url: pageUrl, idempotencyKey: 'public-links-recurrence' })
      await completeBroad(recurrence.auditId!)
      const again = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'broken-internal-links' } })
      expect(again.status).toBe('REGRESSED')
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: again.id } })).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: original.improvementId } })).toMatchObject({ status: 'PROPOSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.auditId })
    } finally { publicLinksMode = 'failed'; transport.mockRestore() }
  }, 90_000)

  it('detects exact section targets and verifies all original fragments through uncertainty, repair and recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/sections'
    try {
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      async function completeBroad(auditId: string) {
        await vi.waitFor(async () => {
          // The declared document targets use the actual independent browser
          // capture. Unrelated optional capabilities remain honestly unavailable.
          await prisma.auditVerifierExecution.updateMany({ where: { auditId,
            workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] }, workState: { not: 'COMPLETED' } },
            data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(auditId))
          expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 250 })
      }
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: pageUrl, idempotencyKey: 'sections-source' })
      await completeBroad(source.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'broken-page-anchors' } })
      expect(flag).toMatchObject({ verificationRule: SECTION_LINK_VERIFICATION_RULE, affectedPaths: [pageUrl, origin + '/sections-peer'] })
      expect(flag.evidenceTargets).toHaveLength(2)
      expect(flag.evidenceTargets).toMatchObject([{ context: expect.stringMatching(/^section:[a-f0-9]{64}:[a-f0-9]{64}$/) },
        { context: expect.stringMatching(/^section:[a-f0-9]{64}:[a-f0-9]{64}$/) }])
      const observed = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'module:seo', scopeKey: 'page:' + pageUrl } })
      expect(observed.detail).toMatchObject({ complete: true, assertions: expect.arrayContaining([
        expect.objectContaining({ key: 'section-target', passed: false, complete: true }),
        expect.objectContaining({ key: 'section-target', passed: true, complete: true }),
      ]), execution: { source: 'rendered-dom' } })
      async function verify(phase: string) {
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'sections-fix:' + phase,
          changeSummary: 'Restore the original section targets' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
          attemptId: fix.attemptId, source: 'WEB', idempotencyKey: 'sections-verify:' + phase })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Section-link verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId, workKind: { not: null } } })).map(task => task.workKind).sort())
          .toEqual(['browser', 'browser', 'check', 'check', 'finalize'])
        return { auditId: run.verificationAuditId, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      expect((await verify('unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      sectionLinksMode = 'partial'
      expect((await verify('partly-repaired')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      for (const phase of ['challenge', 'changed', 'removed'] as const) {
        sectionLinksMode = phase
        expect((await verify(phase)).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      sectionLinksMode = 'healthy'
      const repaired = await verify('repaired')
      const rendered = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId,
        workKind: 'browser', pageUrl: origin + '/sections-peer' } })
      expect((readArtifact(rendered.workResult, 'browser').data as { metadata: { elementIds: string[] } }).metadata.elementIds).toContain('café')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, targetKey: 'check:broken-page-anchors' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom', assertion: { complete: true } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      sectionLinksMode = 'failed'
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', url: pageUrl, idempotencyKey: 'sections-recurrence' })
      await completeBroad(recurrence.auditId!)
      const again = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'broken-page-anchors' } })
      expect(again.status).toBe('REGRESSED')
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: again.id } })).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
    } finally { sectionLinksMode = 'failed'; transport.mockRestore() }
  }, 90_000)

  it('verifies the original primary action through honest gaps, repair and recurrence using real Chromium and the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/primary-action'
    const owner = userId + '-primary', site = projectId + '-primary'
    try {
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: site, userId: owner, name: 'Primary action fixture', url: pageUrl, canonicalHost: 'example.com' } })
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      async function completeBroad(auditId: string) {
        await vi.waitFor(async () => {
          await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' }, OR: [
            { workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'slow-replay', 'journeys'] } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'form-validation' } },
          ] }, data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(auditId))
          expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 250 })
      }
      const source = await requestSiteRun({ projectId: site, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'primary-source' })
      await completeBroad(source.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'flow-cta-404' } })
      expect(flag.verificationRule).toBe(PRIMARY_ACTION_VERIFICATION_RULE)
      expect(flag.evidenceTargets).toMatchObject([{ context: expect.stringMatching(/^flow:control:/) }])
      expect(flag.evidence).not.toContain('PRIVATE_ACTION_VALUE')
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: source.auditId!, targetKey: 'module:flow' } }))
        .toMatchObject({ detail: { assertions: expect.arrayContaining([{ key: 'primary-action-response', name: 'Primary action destination response',
          expected: expect.any(String), observed: expect.stringContaining('404'), passed: false, complete: true, context: expect.stringMatching(/^flow:control:/) }]) } })
      async function verify(phase: string) {
        const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, idempotencyKey: 'primary-fix:' + phase,
          changeSummary: 'Repair the original primary action destination' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site, flagId: flag.id, userId: owner,
          attemptId: fix.attemptId, source: 'WEB', idempotencyKey: 'primary-verify:' + phase })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Primary action verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, workKind: { not: null } } })).map(task => task.workKind).sort())
          .toEqual(['browser', 'finalize', 'flow'])
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      expect((await verify('unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      for (const mode of ['blocked', 'challenge', 'changed', 'removed'] as const) {
        primaryActionMode = mode
        const observed = await verify(mode)
        expect(observed.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.count({ where: { auditId: observed.run.verificationAuditId!, checkId: 'flow-cta-404' } })).toBe(0)
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
      primaryActionMode = 'competing'
      expect((await verify('competing')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      primaryActionMode = 'healthy'
      const repaired = await verify('repaired')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.verificationAuditId })
      expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: {
        auditId: repaired.run.verificationAuditId!, targetKey: 'check:flow-cta-404' } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
      const detail = await loadSiteFlagDetail((await loadSiteRecord(site))!, flag.id)
      expect(detail).toMatchObject({ verificationState: 'verified', verifying: false })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      primaryActionMode = 'failed'
      const recurrence = await requestSiteRun({ projectId: site, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'primary-recurrence' })
      await completeBroad(recurrence.auditId!)
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'flow-cta-404' } })
      expect(repeated.status).toBe('REGRESSED')
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.verificationAuditId })
    } finally { primaryActionMode = 'failed'; transport.mockRestore() }
  }, 100_000)

  it('collects missing, disabled and dead-end primary controls and independently verifies their actual repairs', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/primary-control'
    const owner = userId + '-controls', site = projectId + '-controls'
    try {
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: site, userId: owner, name: 'Primary control fixture', url: pageUrl, canonicalHost: 'example.com' } })
      await getAuditTaskQueue('browser').resume()
      for (const [mode, checkId, kind] of [
        ['missing', 'flow-no-cta-found', 'button'], ['disabled', 'flow-cta-unclickable', 'button'], ['disabled', 'flow-cta-unclickable', 'role'], ['deadend', 'flow-cta-dead-end', 'link'],
      ] as const) {
        primaryControlMode = mode; primaryControlKind = kind
        const session = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, deadline: Date.now() + 20_000 })
        let flags
        try {
          const observed = await runFlowScan(session.page, 'primary-control-source', pageUrl, { primaryOnly: true, captureSteps: false, deadlineMs: 12_000 })
          flags = runFlowChecks(observed).map(flag => ({ ...flag, pageUrl }))
          expect(flags.map(flag => flag.checkId)).toContain(checkId)
          expect(observed.actionEvidence).toBeDefined()
        } finally { session.disposeNetwork(); await session.page.context().close() }
        const source = await prisma.audit.create({ data: { projectId: site, userId: owner, url: pageUrl, status: 'COMPLETED', isPublic: false,
          startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: { version: 1, engine: 'progressive-v1',
            targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: Object.fromEntries(PRIMARY_ACTION_CHECKS.map(id => [id, 1])), outcomes: [], verificationTarget: null } } })
        await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId } })
        expect(flag.verificationRule).toBe(PRIMARY_ACTION_VERIFICATION_RULE)
        primaryControlMode = 'healthy'
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site, flagId: flag.id, userId: owner,
          source: 'WEB', idempotencyKey: 'primary-control-verify:' + mode + ':' + kind })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Primary control repair was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: verified.attemptId! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.verificationAuditId })
        expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: {
          auditId: verified.verificationAuditId!, targetKey: 'check:' + checkId } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
      }
    } finally { primaryControlMode = 'missing'; primaryControlKind = 'button'; transport.mockRestore() }
  }, 90_000)

  it('observes delayed signup completion and preserves actionable failure, uncertainty, repair and recurrence', async () => {
    const transport = fixtureTransport()
    try {
      const fixture = await prisma.outcomeFixture.create({ data: { projectId, name: 'Reversible signup', targetUrl: origin + '/signup-flow',
        fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Sign up' } },
        encryptedValues: encryptSecret(JSON.stringify({ email: 'synthetic@example.test' })),
        successCriterion: { type: 'text', value: 'Check your inbox' }, resetUrl: origin + '/signup-reset', cleanupUrl: origin + '/signup-cleanup' } })
      const setup = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'FIXTURE_SETUP', fixtureId: fixture.id,
        idempotencyKey: 'signup-functional-setup' })
      await vi.waitFor(async () => {
        expect(await prisma.runRequest.findUnique({ where: { id: setup.runId } })).toMatchObject({ status: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.outcomeFixture.findUnique({ where: { id: fixture.id } })).toMatchObject({
        lastDryRunVersion: 1, lastDryRunResult: { disposition: 'SUCCEEDED', detail: { cleanupStatus: 'succeeded' } } })
      await authorizeOutcomeFixture(projectId, fixture.id)
      const outcome = await prisma.siteOutcome.create({ data: { projectId, slug: 'signup-functional', name: 'Signup completes', kind: 'SIGNUP',
        bindings: { create: { key: 'signup-v1', mechanism: 'SAFE_FORM', required: true,
          config: { startUrl: origin + '/signup-flow', safety: 'reversible', authorized: true, fixtureId: fixture.id } } } } })
      const audits: string[] = []
      let attemptId = ''
      const phases = [
        { mode: 'missing', cleanup: true }, { mode: 'preexisting', cleanup: true },
        { mode: 'success', cleanup: false }, { mode: 'success', cleanup: true }, { mode: 'missing', cleanup: true },
      ] as const
      for (const [index, { mode, cleanup }] of phases.entries()) {
        signupMode = mode
        signupCleanupOk = cleanup
        const submissionsBefore = signupSubmissions
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'signup-functional:' + index })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: run.runId } })).toMatchObject({ status: 'COMPLETED' })
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        expect(signupSubmissions - submissionsBefore).toBe(mode === 'preexisting' ? 0 : 1)
        const execution = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId: run.auditId!, outcomeId: outcome.id } })
        expect(execution.disposition).toBe(mode === 'missing' ? 'FAILED' : mode === 'success' && cleanup ? 'SUCCEEDED' : 'BLOCKED')
        expect(JSON.stringify(execution.detail)).not.toContain('synthetic@example.test')
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: run.runId, outcomeId: outcome.id } } })
        expect(assessment.state).toBe(mode === 'missing' ? 'FLAG' : mode === 'success' && cleanup ? 'CLEAR' : 'COULD_NOT_VERIFY')
        if (!cleanup) expect(execution).toMatchObject({ reason: 'fixture_cleanup_unproven', detail: {
          cleanupStatus: 'failed', successObservation: { presentBeforeSubmit: false, presentAfterSubmit: true } } })
        const flags = await prisma.flag.findMany({ where: { auditId: run.auditId! } })
        expect(flags).toHaveLength(mode === 'missing' ? 1 : 0)
        if (mode === 'missing') {
          expect(execution.detail).toMatchObject({ failureFlagId: flags[0].id })
          expect(assessment.improvementId).toBeTruthy()
          expect(flags[0]).toMatchObject({ fingerprint: 'outcome:v1:' + outcome.id + ':signup-v1', checkId: 'outcome-signup-failed' })
          expect(flags[0].evidence).not.toContain('synthetic@example.test')
        }
        if (index === 0) attemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: flags[0].id, userId,
          idempotencyKey: 'signup-functional-fix', changeSummary: 'Restore signup completion feedback' })).attemptId
        if (index === 1 || index === 2) expect(await prisma.flag.findFirst({ where: { auditId: audits[0] } })).toMatchObject({ status: 'OPEN' })
      }
      const failed = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[0] } })
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[4] } })
      expect(failed).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(recurred.status).toBe('REGRESSED')
      const occurrences = await prisma.improvementOccurrence.findMany({ where: { flagId: { in: [failed.id, recurred.id] } } })
      expect(new Set(occurrences.map(item => item.improvementId)).size).toBe(1)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
        verificationAuditId: audits[3] })
      const verificationHistory = await prisma.improvementCycleEvent.findMany({ where: { attemptId, type: 'OUTCOME_ISSUED' },
        orderBy: { occurredAt: 'asc' }, select: { outcome: true, verificationAuditId: true } })
      expect(verificationHistory).toEqual([{ outcome: 'INCONCLUSIVE', verificationAuditId: audits[1] }, { outcome: 'IMPROVED', verificationAuditId: audits[3] }])
    } finally { signupMode = 'success'; signupCleanupOk = true; transport.mockRestore() }
  }, 60_000)

  it('preserves the latest Watch delivery across stale readers and expired senders using the real notification ledger', async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>(complete => { resolve = complete })
      return { promise, resolve }
    }
    const forwardedFetch = globalThis.fetch
    const providerRequests: Array<{ key: string | null; body: { to: string; subject: string; html: string } }> = []
    const providerResponses: Array<Response | Promise<Response>> = []
    const accepted = () => new Response(JSON.stringify({ id: 'fixture-provider-accepted' }), { status: 200, headers: { 'content-type': 'application/json' } })
    const rejected = () => new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'Fixture provider retry required' }),
      { status: 429, headers: { 'content-type': 'application/json' } })
    let providerTransport: ReturnType<typeof vi.spyOn> | undefined
    let reader: ReturnType<typeof vi.spyOn> | undefined
    let releaseRead: ReturnType<typeof deferred<void>> | undefined
    const heldResponses: Array<ReturnType<typeof deferred<Response>>> = []
    const deliveries: Array<Promise<void>> = []
    try {
      await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      availabilityStatus = 503
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'notification-ledger-source' })
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: source.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      const auditId = source.auditId!
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId, checkId: 'outcome-availability-failed' } })
      expect((await getFlagDiffSummary(null, auditId)).newIssues.map(item => item.id)).toContain(flag.id)
      notificationBoundary.provider = new Resend('re_fixture_not_a_real_key')
      providerTransport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        if (url.origin !== 'https://api.resend.com') return forwardedFetch(input, options)
        if (url.pathname !== '/emails') throw new Error('Unexpected fixture provider operation')
        providerRequests.push({ key: new Headers(options?.headers).get('Idempotency-Key'), body: JSON.parse(String(options?.body)) })
        return await (providerResponses.shift() ?? accepted())
      })
      async function resetDelivery() {
        // Reset only this fixture's operational delivery state. Website evidence,
        // incident identity and the committed comparison remain unchanged.
        await prisma.audit.update({ where: { id: auditId }, data: { watchRegressionCount: null, watchRecoveryCount: null,
          watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotifiedAt: null,
          watchNotificationLeaseUntil: null, watchNotificationLastError: null } })
      }
      await resetDelivery()
      const originalReader = prisma.audit.findUnique.bind(prisma.audit)
      const readHeld = deferred<void>()
      releaseRead = deferred<void>()
      let holdNextRead = true
      reader = vi.spyOn(prisma.audit, 'findUnique').mockImplementation(async args => {
        const snapshot = await originalReader(args)
        if (holdNextRead && args.where.id === auditId && args.select?.watchRegressionCount) {
          holdNextRead = false
          readHeld.resolve()
          await releaseRead!.promise
        }
        return snapshot
      })
      const pendingRead = notifyWatchRegression(null, auditId)
      deliveries.push(pendingRead)
      await readHeld.promise
      await notifyWatchRegression(null, auditId)
      const delivered = await originalReader({ where: { id: auditId } })
      expect(delivered).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1, watchNotifiedAt: expect.any(Date) })
      releaseRead.resolve()
      await pendingRead
      reader.mockRestore(); reader = undefined
      expect(providerRequests).toHaveLength(1)
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1,
        watchNotifiedAt: delivered!.watchNotifiedAt })

      // A blocked old HTTP call returns after a newer claim has accepted mail.
      // Its rejection must not replace the newer provider acceptance.
      await resetDelivery()
      const rejectedOldSend = deferred<Response>()
      heldResponses.push(rejectedOldSend)
      providerResponses.push(rejectedOldSend.promise, accepted())
      const oldRejection = notifyWatchRegression(null, auditId)
      deliveries.push(oldRejection)
      await vi.waitFor(() => expect(providerRequests).toHaveLength(2), { timeout: 3000, interval: 20 })
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1 })
      await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationLeaseUntil: new Date(0) } })
      await notifyWatchRegression(null, auditId)
      const reclaimed = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      expect(reclaimed).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 2 })
      rejectedOldSend.resolve(rejected())
      await oldRejection
      const retained = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      expect(retained).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 2,
        watchNotifiedAt: reclaimed.watchNotifiedAt, watchNotificationLastError: null })
      expect(watchAlertDelivery({ status: retained.watchNotificationStatus, attempts: retained.watchNotificationAttempts })).toBe('accepted')
      await notifyWatchRegression(null, auditId)
      expect(providerRequests).toHaveLength(3)

      // The converse also matters: old acceptance cannot release a live newer
      // sender or publish its lifecycle event before that sender completes.
      await resetDelivery()
      const previousSend = deferred<Response>(), currentSend = deferred<Response>()
      heldResponses.push(previousSend, currentSend)
      providerResponses.push(previousSend.promise, currentSend.promise)
      const oldAcceptance = notifyWatchRegression(null, auditId)
      deliveries.push(oldAcceptance)
      await vi.waitFor(() => expect(providerRequests).toHaveLength(4), { timeout: 3000, interval: 20 })
      await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationLeaseUntil: new Date(0) } })
      const current = notifyWatchRegression(null, auditId)
      deliveries.push(current)
      await vi.waitFor(() => expect(providerRequests).toHaveLength(5), { timeout: 3000, interval: 20 })
      const currentClaim = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      previousSend.resolve(accepted())
      await oldAcceptance
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 2,
        watchNotificationLeaseUntil: currentClaim.watchNotificationLeaseUntil, watchNotifiedAt: null })
      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'OFF' } })
      await notifyWatchRegression(null, auditId)
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 2,
        watchNotificationLeaseUntil: currentClaim.watchNotificationLeaseUntil })
      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
      currentSend.resolve(accepted())
      await current
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 2 })

      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'OFF' } })
      await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationStatus: 'SENDING', watchNotificationAttempts: 5,
        watchNotificationLeaseUntil: new Date(0), watchNotifiedAt: null } })
      await notifyWatchRegression(null, auditId)
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationLeaseUntil: null })
      expect(providerRequests).toHaveLength(5)
      for (const request of providerRequests) {
        expect(request.key).toBe(`fixflags-watch-${auditId}-v1`)
        expect(request.body).toMatchObject({ to: userId + '@example.test', subject: 'Needs attention on example.com: 1 Flag',
          html: expect.stringContaining(`/sites/${projectId}/flags/${flag.id}?source=watch-email`) })
      }
    } finally {
      releaseRead?.resolve()
      heldResponses.forEach(response => response.resolve(rejected()))
      await Promise.allSettled(deliveries)
      reader?.mockRestore(); providerTransport?.mockRestore(); notificationBoundary.provider = null
      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
      availabilityStatus = 200
    }
  }, 60_000)

  it('runs default uptime independently of a customer session and retains real challenge uncertainty', async () => {
    const transport = fixtureTransport()
    try {
      expect(await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))).toBe(true)
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(project).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date) })
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      for (const challenged of [false, true]) {
        availabilityChallenged = challenged
        const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH',
          idempotencyKey: 'automatic-availability:' + challenged })
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        const observed = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId: admitted.auditId!, outcomeId: outcome.id } })
        expect(observed).toMatchObject({ disposition: challenged ? 'BLOCKED' : 'SUCCEEDED', reason: challenged ? 'bot_wall' : 'available' })
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: admitted.runId, outcomeId: outcome.id } } })
        expect(assessment.state).toBe(challenged ? 'COULD_NOT_VERIFY' : 'CLEAR')
        expect(await prisma.flag.count({ where: { auditId: admitted.auditId! } })).toBe(0)
      }
    } finally { availabilityChallenged = false; transport.mockRestore() }
  }, 30_000)

  it.each(['header', 'title'] as const)('preserves an actual HTTP 200 challenge response in browser refusal evidence: %s', async mode => {
    const transport = fixtureTransport()
    monitoredChallenge = mode
    try {
      await expect(pageSessions.createAuditPage(await getAuditBrowser(), origin + '/monitored', {
        profile: DESKTOP_CAPTURE_PROFILE, deadline: Date.now() + 8000,
      })).rejects.toMatchObject({ code: 'HTTP_FORBIDDEN', httpStatus: 200, contentType: 'text/html', finalUrl: origin + '/monitored' })
    } finally { monitoredChallenge = null; transport.mockRestore() }
  })

  it('independently verifies every originally failed response header through HTTP, the task ledger and fix projection', async () => {
    const transport = fixtureTransport()
    try {
      const pageUrl = origin + '/headers'
      headerMode = 'failed'
      const observed = await collectDocument(pageUrl, Date.now() + 8000)
      expect(observed).toMatchObject({ status: 200, complete: true })
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistDeterministicFlags(source.id, runSecurityHeaderChecks(observed.finalUrl, observed.headers).map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'security-headers-missing' } })
      expect(flag.evidenceTargets).toHaveLength(4)
      for (const mode of ['partial', 'challenge', 'redirected', 'healthy'] as const) {
        headerMode = mode
        const fixed = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'headers-fix:' + mode, changeSummary: 'Restore the recorded response header configuration' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'headers-verify:' + mode,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: fixed.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const expected = mode === 'partial' ? 'UNCHANGED' : mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: expected,
          comparable: expected !== 'INCONCLUSIVE', verificationAuditId: run.auditId })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: mode === 'healthy' ? 'FIXED' : 'OPEN' })
        if (mode === 'partial') expect(await prisma.flag.findMany({ where: { auditId: run.auditId! }, select: { checkId: true } })).toEqual([{ checkId: 'security-hsts-too-short' }])
        if (mode === 'healthy') {
          const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'check:security-headers-missing' } })
          expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', assertion: { complete: true, passed: true } })
        }
      }
    } finally { headerMode = 'failed'; transport.mockRestore() }
  }, 45_000)

  it('preserves one uptime incident through a gap, proves recovery and recognizes recurrence', async () => {
    const transport = fixtureTransport()
    try {
      await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      const audits: string[] = []
      let automaticAttemptId: string | undefined
      for (const [index, state] of [503, 'challenge', 503, 200, 503].entries()) {
        availabilityStatus = typeof state === 'number' ? state : 200
        availabilityChallenged = state === 'challenge'
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'uptime-cycle:' + index })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: run.runId } })).toMatchObject({ status: 'COMPLETED' })
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        if (index === 2) {
          const sourceFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, checkId: 'outcome-availability-failed' } })
          automaticAttemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: sourceFlag.id, userId,
            idempotencyKey: 'uptime-ready-to-verify', changeSummary: 'Restore the public page response' })).attemptId
        }
      }
      const first = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[0], checkId: 'outcome-availability-failed' } })
      const continued = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[2], checkId: 'outcome-availability-failed' } })
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[4], checkId: 'outcome-availability-failed' } })
      expect(first).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(continued).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(recurred).toMatchObject({ status: 'REGRESSED', resolvedInId: null })
      const occurrences = await prisma.improvementOccurrence.findMany({ where: { flagId: { in: [first.id, continued.id, recurred.id] } } })
      expect(new Set(occurrences.map(item => item.improvementId)).size).toBe(1)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: automaticAttemptId! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: audits[3] })
      const counts = await prisma.audit.findMany({ where: { id: { in: audits } }, select: { id: true, watchRegressionCount: true, watchRecoveryCount: true } })
      expect(audits.map(id => counts.find(item => item.id === id))).toMatchObject([
        { watchRegressionCount: 1, watchRecoveryCount: 0 }, { watchRegressionCount: 0, watchRecoveryCount: 0 },
        { watchRegressionCount: 0, watchRecoveryCount: 0 }, { watchRegressionCount: 0, watchRecoveryCount: 1 },
        { watchRegressionCount: 1, watchRecoveryCount: 0 },
      ])
      const history = await loadMonitoringHistory((await loadSiteRecord(projectId))!)
      expect(history.timeline.find(item => item.id === audits[3])).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
      expect(history.timeline.find(item => item.id === audits[1])).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      const liveLease = new Date(Date.now() + 60_000)
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: liveLease } })
      await notifyWatchRegression(null, audits[0])
      expect(await prisma.project.findUnique({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: saved.watchLastRunAt, watchLeaseUntil: liveLease })
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    } finally { availabilityStatus = 200; availabilityChallenged = false; transport.mockRestore() }
  }, 60_000)

  it('keeps a proven historical uptime Improvement identity when migrating its single bound responsibility', async () => {
    const transport = fixtureTransport()
    try {
      const outcome = await prisma.siteOutcome.create({ data: { projectId, slug: 'legacy-uptime', name: 'Historical availability', kind: 'AVAILABILITY',
        confirmedAt: new Date(), bindings: { create: { key: 'legacy-http', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: origin + '/', expectedSelector: 'body' } } } } })
      availabilityStatus = 503
      const before = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'legacy-source' })
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: before.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: before.auditId!, checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      const improvementId = flag.improvementOccurrence!.improvementId
      const assessment = await prisma.outcomeAssessment.findFirstOrThrow({ where: { auditId: before.auditId!, outcomeId: outcome.id } })
      const historicalEvidence = { ...(assessment.evidence as Record<string, unknown>) }
      delete historicalEvidence.incident
      // Model the prior persisted contract while retaining its real execution,
      // version, scope and original IDs. No positive website result is invented.
      await prisma.outcomeAssessment.update({ where: { id: assessment.id }, data: { evidence: historicalEvidence as import('@prisma/client').Prisma.InputJsonValue } })
      await prisma.flag.update({ where: { id: flag.id }, data: { fingerprint: 'outcome:availability:legacy-http' } })
      await prisma.improvement.update({ where: { id: improvementId }, data: { fingerprint: 'check:outcome-availability-failed' } })
      const runs: string[] = []
      for (const [index, status] of [503, 200, 503].entries()) {
        availabilityStatus = status
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'legacy-followup:' + index })
        runs.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
      }
      expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: runs[1] })
      const current = await prisma.flag.findFirstOrThrow({ where: { auditId: runs[2], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      expect(current).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId } })
      expect(await prisma.improvement.count({ where: { projectId, outcomeId: outcome.id } })).toBe(1)
    } finally { availabilityStatus = 200; transport.mockRestore() }
  }, 60_000)

  it('proves Public form validation, safe limits and comparable repairs through Chromium and the worker', async () => {
    const transport = fixtureTransport()
    await getAuditTaskQueue('browser').resume()
    try {
      const pageUrl = origin + '/public-form', token = randomUUID()
      const ordinary = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, deadline: Date.now() + 8000,
      })
      try {
        await ordinary.page.evaluate(() => document.querySelector('form')?.setAttribute('data-fixflags-local-validation', 'forged'))
        expect((await probeFormValidation(ordinary.page, { isolated: true })).evidence).toMatchObject({ disposition: 'unknown', reason: 'submit_handler_suppressed' })
        expect(await ordinary.page.evaluate(() => (window as unknown as { validationCalls: number }).validationCalls)).toBe(0)
      } finally { ordinary.disposeNetwork(); await ordinary.page.context().close() }
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 10_000,
      })
      let probe
      try {
        probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 4000 })
        expect(probe.evidence).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
        expect(await session.page.evaluate(() => (window as unknown as { validationCalls: number }).validationCalls)).toBe(1)
      } finally { session.disposeNetwork(); await session.page.context().close() }
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistDeterministicFlags(source.id, checkFormValidation(probe.evidence).flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'flow-form-no-validation' } })
      let slowFlag: typeof flag | undefined
      for (const mode of ['blocked', 'socket', 'peer', 'popup', 'hidden', 'prefilled', 'outside', 'unrelated', 'slow', 'healthy'] as const) {
        publicFormMode = mode
        const target = mode === 'healthy' ? slowFlag! : flag
        const fixed = await recordSiteFlagFix({ siteId: projectId, flagId: target.id, userId,
          idempotencyKey: 'public-form-fix:' + mode, changeSummary: 'Restore local required-field feedback on the same form' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'public-form-verify:' + mode, verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: target.checkId!,
            parentAuditId: target.auditId, attemptId: fixed.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const expected = mode === 'unrelated' ? 'UNCHANGED' : mode === 'slow' || mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: expected,
          comparable: expected !== 'INCONCLUSIVE', verificationAuditId: run.auditId })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['finalize', 'flow'])
        const observed = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'module:form-validation' } })
        expect(JSON.stringify(observed.detail)).not.toContain('PRIVATE_FORM_VALUE')
        if (expected === 'INCONCLUSIVE') {
          expect(observed.detail).toMatchObject({ complete: false, passed: false })
          expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
          expect(await prisma.flag.count({ where: { auditId: run.auditId! } })).toBe(0)
        }
        if (mode === 'slow') slowFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, checkId: 'flow-form-slow-feedback' } })
        if (mode === 'slow' || mode === 'healthy') expect(await prisma.flag.findUnique({ where: { id: target.id } })).toMatchObject({ status: 'FIXED', resolvedInId: run.auditId })
      }
      expect(publicFormSubmissions).toBe(0)
      expect(await prisma.flag.findUnique({ where: { id: slowFlag!.id } })).toMatchObject({ status: 'FIXED' })
      publicFormMode = 'healthy'
      const measured = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 8000,
      })
      try {
        const click = measured.page.$.bind(measured.page)
        vi.spyOn(measured.page, '$').mockImplementation(async selector => {
          const element = await click(selector)
          if (element) {
            const nativeClick = element.click.bind(element)
            vi.spyOn(element, 'click').mockImplementation(async options => {
              await nativeClick(options)
              await new Promise(resolve => setTimeout(resolve, 1200))
            })
          }
          return element
        })
        const delayedRead = await probeFormValidation(measured.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 6000 })
        expect(delayedRead.evidence).toMatchObject({ disposition: 'passed', reason: 'client_feedback' })
        expect(delayedRead.feedbackMs!).toBeLessThan(1000)
        expect(checkFormValidation(delayedRead.evidence).flags).toEqual([])
      } finally { measured.disposeNetwork(); await measured.page.context().close() }
    } finally { publicFormMode = 'broken'; transport.mockRestore() }
  }, 45_000)

  it('verifies Performance score and resource repairs from fresh provider observations through the worker', async () => {
    await getAuditTaskQueue('provider').resume()
    try {
      const pageUrl = origin + '/performance-fixture'
      pageSpeedMode = 'failed'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true, strategies: ['desktop'] })
      expect(measured.desktop).not.toBeNull()
      const flags = runPerformanceChecks(measured.desktop, null).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['perf-score-critical', 'render-blocking', 'unused-js-large', 'unused-css-large', 'unoptimized-images'])
      // The historical source is created from the real collector and detector.
      // Fresh verification uses normal admission, queue and application workers.
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { desktop: measured.desktop! } } })
      await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      const attempts = new Map<string, string>()
      for (const flag of findings) attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
        idempotencyKey: 'performance-fix:' + flag.id, changeSummary: 'Remove unnecessary resources and improve loading' })).attemptId)
      const unusedJs = findings.find(flag => flag.checkId === 'unused-js-large')!
      async function verify(flag: typeof unusedJs, phase: string) {
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'performance-verify:' + flag.id + ':' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: attempts.get(flag.id)! } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'pagespeed'])
        return run
      }
      pageSpeedMode = 'missing'
      const unknown = await verify(unusedJs, 'missing')
      expect(await prisma.improvementAttempt.findUnique({ where: { id: attempts.get(unusedJs.id)! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUnique({ where: { id: unusedJs.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unknown.auditId!, targetKey: 'check:unused-js-large' } })).toBeNull()
      const unknownAudit = await prisma.audit.findUniqueOrThrow({ where: { id: unknown.auditId! } })
      const unknownReceipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: unknown.auditId! },
        select: { targetKey: true, status: true, detail: true } })
      const scoreFlag = findings.find(flag => flag.checkId === 'perf-score-critical')!
      expect(hasRecordedRecoveryEvidence({ auditId: unknown.auditId!, executionSpec: unknownAudit.executionSpec,
        flag: scoreFlag, executions: unknownReceipts })).toBe(true)
      expect(hasRecordedRecoveryEvidence({ auditId: unknown.auditId!, executionSpec: unknownAudit.executionSpec,
        flag: unusedJs, executions: unknownReceipts })).toBe(false)
      pageSpeedMode = 'healthy'
      for (const flag of findings) {
        // A fresh verification attempt follows the inconclusive resource check.
        if (flag.id === unusedJs.id) attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'performance-fix-after-gap', changeSummary: 'Confirm the newly measured resource savings' })).attemptId)
        const repaired = await verify(flag, 'healthy')
        expect(await prisma.improvementAttempt.findUnique({ where: { id: attempts.get(flag.id)! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
          verificationAuditId: repaired.auditId })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        expect(await prisma.flag.count({ where: { auditId: repaired.auditId! } })).toBe(0)
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'pagespeed-desktop' })
      }
    } finally { pageSpeedMode = null }
  }, 45_000)

  it('keeps two availability responsibilities independent even when their binding keys match', async () => {
    const transport = fixtureTransport()
    try {
      const original = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      const other = await prisma.siteOutcome.create({ data: { projectId, slug: 'other-page', name: 'Another public page', kind: 'AVAILABILITY',
        confirmedAt: new Date(), bindings: { create: { key: 'page-availability-v1', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: origin + '/independent-page', expectedSelector: 'body' } } } } })
      const ids: string[] = []
      for (const [index, rootFails] of [true, false].entries()) {
        availabilityStatus = rootFails ? 503 : 200
        otherAvailabilityStatus = rootFails ? 200 : 503
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [original.id, other.id], source: 'WATCH', idempotencyKey: 'independent-pages:' + index })
        ids.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
      }
      const first = await prisma.flag.findFirstOrThrow({ where: { auditId: ids[0], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      const second = await prisma.flag.findFirstOrThrow({ where: { auditId: ids[1], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      expect(first).toMatchObject({ status: 'FIXED', resolvedInId: ids[1] })
      expect(second.status).toBe('OPEN')
      expect(first.fingerprint).not.toBe(second.fingerprint)
      expect(first.improvementOccurrence!.improvementId).not.toBe(second.improvementOccurrence!.improvementId)
      expect(await prisma.outcomeAssessment.findMany({ where: { auditId: ids[1] }, select: { outcomeId: true, state: true } })).toEqual(expect.arrayContaining([
        { outcomeId: original.id, state: 'CLEAR' }, { outcomeId: other.id, state: 'FLAG' },
      ]))
    } finally { availabilityStatus = 200; otherAvailabilityStatus = 200; transport.mockRestore() }
  }, 30_000)

  it.skipIf(process.env.FIX_INTENTS_DB_REQUIRED !== 'true')('preserves immutable fix intents under concurrent retries, later repairs and exact worker reconciliation', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/headers'
    try {
      headerMode = 'partial'
      const document = await collectDocument(pageUrl, Date.now() + 8000)
      const finding = runSecurityHeaderChecks(pageUrl, document.headers).find(flag => flag.checkId === 'security-hsts-too-short')!
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      await persistDeterministicFlags(source.id, [{ ...finding, pageUrl }], { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: finding.checkId } })
      const input = { siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'immutable-fix:first',
        changeSummary: 'Restore the original HSTS responsibility', commitReference: 'fixture-commit-one', deploymentReference: 'fixture-deploy-one', client: 'mcp' }
      const results = await Promise.all(Array.from({ length: 8 }, () => recordSiteFlagFix(input)))
      expect(new Set(results.map(result => result.attemptId)).size).toBe(1)
      const firstId = results[0].attemptId
      const initial = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: firstId } })
      expect(initial).toMatchObject({ idempotencyKey: input.idempotencyKey, commitReference: input.commitReference,
        changeSummary: input.changeSummary, deploymentReference: input.deploymentReference, outcome: null, verificationAuditId: null, frozen: true })
      await expect(prisma.improvementAttempt.update({ where: { id: firstId }, data: { changeSummary: 'A forbidden metadata overwrite' } }))
        .rejects.toThrow('Recorded improvement attempt intent is immutable')
      expect(await prisma.improvementAttempt.update({ where: { id: firstId }, data: { frozen: false } })).toMatchObject({ frozen: true })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: initial.improvementId } })).toBe(1)
      expect(await prisma.improvementCycleEvent.count({ where: { attemptId: firstId, type: 'ATTEMPTED' } })).toBe(1)
      expect(await loadSiteFlagDetail((await loadSiteRecord(projectId))!, flag.id)).toMatchObject({ verifying: false, verificationState: 'unverified' })
      expect((await loadSiteFlagDetail((await loadSiteRecord(projectId))!, flag.id))?.attempts[0]).toMatchObject({
        commitReference: input.commitReference, deploymentReference: input.deploymentReference, sourceAuditId: source.id,
      })
      expect(await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId })).toMatchObject({
        attemptId: firstId, changeSummary: input.changeSummary, commitReference: input.commitReference,
      })
      await getAuditTaskQueue('http').pause()
      const firstRun = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        attemptId: firstId, source: 'MCP', idempotencyKey: 'immutable-verify:first' })
      if (!firstRun.ok || !('verificationAuditId' in firstRun)) throw new Error('Verification was not admitted')
      expect(await loadSiteFlagDetail((await loadSiteRecord(projectId))!, flag.id)).toMatchObject({ verifying: true })
      const second = await recordSiteFlagFix({ ...input, idempotencyKey: 'immutable-fix:second',
        changeSummary: 'A later declared repair', commitReference: 'fixture-commit-two', deploymentReference: 'fixture-deploy-two' })
      expect(second.attemptId).not.toBe(firstId)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: firstId } })).toMatchObject({
        changeSummary: input.changeSummary, commitReference: input.commitReference, verificationAuditId: firstRun.verificationAuditId,
      })
      headerMode = 'healthy'; await getAuditTaskQueue('http').resume()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: firstRun.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: firstId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: second.attemptId } })).toMatchObject({ outcome: null, verificationAuditId: null })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: initial.improvementId } })).toMatchObject({ status: 'READY_TO_VERIFY' })
      expect(await recordSiteFlagFix(input)).toMatchObject({ attemptId: firstId, outcome: 'IMPROVED', verificationAuditId: firstRun.verificationAuditId })
      await expect(recordSiteFlagFix({ ...input, commitReference: 'different-commit' })).rejects.toMatchObject({ code: 'FIX_INTENT_MISMATCH', status: 409 })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: initial.improvementId } })).toBe(2)
      const replay = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        attemptId: firstId, source: 'MCP', idempotencyKey: 'immutable-verify:first' })
      expect(replay).toMatchObject({ runId: firstRun.runId, verificationAuditId: firstRun.verificationAuditId, attemptId: firstId })
      const secondRun = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        attemptId: second.attemptId, source: 'MCP', idempotencyKey: 'immutable-verify:second' })
      if (!secondRun.ok || !('verificationAuditId' in secondRun)) throw new Error('Later verification was not admitted')
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: secondRun.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: second.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: initial.improvementId } })).toMatchObject({ status: 'VERIFIED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: firstRun.verificationAuditId })
      expect(await prisma.improvementCycleEvent.count({ where: { attemptId: firstId, type: 'ATTEMPTED' } })).toBe(1)
      expect(await prisma.improvementCycleEvent.count({ where: { attemptId: second.attemptId, type: 'ATTEMPTED' } })).toBe(1)
      expect(await loadSiteFlagDetail((await loadSiteRecord(projectId))!, flag.id)).toMatchObject({ verifying: false })
      // Web verification records an implicit fix. Replay validates that same
      // declaration after completion, without creating another attempt or run.
      const web = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        source: 'WEB', idempotencyKey: 'immutable-verify:web', changeSummary: 'An independent web readiness request' })
      if (!web.ok || !('verificationAuditId' in web)) throw new Error('Web verification was not admitted')
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: web.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        source: 'WEB', idempotencyKey: 'immutable-verify:web', changeSummary: 'An independent web readiness request' }))
        .toMatchObject({ runId: web.runId, attemptId: web.attemptId })
      await expect(executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId,
        source: 'WEB', idempotencyKey: 'immutable-verify:web', changeSummary: 'A changed declaration under the old key' })).rejects.toMatchObject({ status: 409 })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: initial.improvementId } })).toBe(3)
      await expect(recordSiteFlagFix({ ...input, userId: 'other-owner' })).rejects.toThrow('Site not found')
    } finally { headerMode = 'failed'; await getAuditTaskQueue('http').resume(); transport.mockRestore() }
  }, 60_000)

  it.skipIf(process.env.ACCESSIBILITY_DB_REQUIRED !== 'true')('proves independent Accessibility rule repair, unresolved contrast, affected pages and recurrence through Chromium and workers', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/accessibility', other = origin + '/accessibility-linked'
    try {
      await getAuditTaskQueue('browser').resume()
      const captures = await Promise.all([pageUrl, other].map(url => captureScreenshots(url, 'accessibility-source', undefined,
        { runFlow: false, captureMedia: false, deadline: Date.now() + 12_000 })))
      const flags = []
      for (const [index, snapshot] of captures.entries()) {
        expect(snapshot.accessibilityEvidence?.rules.find(rule => rule.id === 'button-name')).toMatchObject({ state: 'failed' })
        const url = [pageUrl, other][index]
        const metadata = parseMetadataFromHtml(snapshot.desktopHtml!, snapshot.desktopFinalUrl!)
        const checked = await runAllChecks(url, metadata, null, null, snapshot.consoleErrors, undefined, snapshot.captureMetrics,
          snapshot.responseHeaders, snapshot.axeViolations, true, ['accessibility'], { accessibilityEvidence: snapshot.accessibilityEvidence, renderedScope: snapshot.renderedScope })
        flags.push(...checked.flags.map(flag => ({ ...flag, pageUrl: url })))
      }
      expect(flags.map(flag => flag.checkId)).toEqual(expect.arrayContaining(['buttons-no-text', 'form-inputs-no-label', 'iframe-no-title', 'color-contrast-poor', 'axe-aria-hidden-focus']))
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', reviewDepth: 2,
        startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: { version: 1, engine: 'progressive-v1',
          targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: Object.fromEntries(flags.map(flag => [flag.checkId, 1])), outcomes: [], verificationTarget: null } } })
      await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      const buttons = findings.find(flag => flag.checkId === 'buttons-no-text')!, contrast = findings.find(flag => flag.checkId === 'color-contrast-poor')!
      const aria = findings.find(flag => flag.checkId === 'axe-aria-hidden-focus')!
      expect(buttons.affectedPaths).toEqual([pageUrl, other]); expect(buttons.evidenceTargets).toHaveLength(2)
      let attemptId = ''
      async function verify(flag: typeof buttons, phase: string) {
        attemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'accessibility-fix:' + phase,
          changeSummary: 'Repair the recorded accessible controls and rule conditions' })).attemptId
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'accessibility-verify:' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, parentAuditId: source.id, attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 }).catch(async error => {
          const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } },
            select: { targetKey: true, workState: true, workErrorCode: true } })
          throw new Error('Accessibility verification unfinished (' + phase + '): ' + JSON.stringify(tasks), { cause: error })
        })
        return run
      }
      await verify(buttons, 'unrepaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      accessibilityNames = true
      await verify(buttons, 'partial')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      accessibilityOtherUnavailable = true
      const unavailable = await verify(buttons, 'unavailable')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unavailable.auditId!, targetKey: 'check:buttons-no-text' } })).toBeNull()
      accessibilityOtherUnavailable = false; accessibilityOtherNames = true
      const repaired = await verify(buttons, 'names-repaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: buttons.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
      const repairedEvidence = await prisma.audit.findUniqueOrThrow({ where: { id: repaired.auditId! }, include: { verifierExecutions: true } })
      expect(hasRecordedRecoveryEvidence({ auditId: repaired.auditId!, executionSpec: repairedEvidence.executionSpec,
        flag: findings.find(flag => flag.checkId === 'iframe-no-title')!, executions: repairedEvidence.verifierExecutions })).toBe(true)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: contrast.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: aria.id } })).toMatchObject({ status: 'OPEN' })
      accessibilityContrast = true; accessibilityUncertain = true
      const unresolved = await verify(contrast, 'contrast-unresolved')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: unresolved.auditId!, workKind: 'browser' } })
      expect(readArtifact(browser.workResult, 'browser').data.snapshot).toMatchObject({ accessibilityEvidence: {
        rules: expect.arrayContaining([{ id: 'color-contrast', state: 'incomplete', nodes: expect.any(Number) }]),
      } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: contrast.id } })).toMatchObject({ status: 'OPEN' })
      accessibilityUncertain = false
      const contrastRepair = await verify(contrast, 'contrast-repaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: contrast.id } })).toMatchObject({ status: 'FIXED', resolvedInId: contrastRepair.auditId })
      accessibilityAria = true
      const ariaRepair = await verify(aria, 'aria-repaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: aria.id } })).toMatchObject({ status: 'FIXED', resolvedInId: ariaRepair.auditId })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: buttons.id } })
      accessibilityNames = false; accessibilityOtherNames = false
      await getAuditTaskQueue('provider').pause()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'accessibility-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, workKind: 'discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'buttons-no-text' }, include: { improvementOccurrence: true } })
      expect(repeated.status).toBe('REGRESSED')
      expect(repeated.improvementOccurrence).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: buttons.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
    } finally {
      accessibilityNames = false; accessibilityOtherNames = false; accessibilityContrast = false; accessibilityAria = false
      accessibilityUncertain = false; accessibilityOtherUnavailable = false
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume(); transport.mockRestore()
    }
  }, 100_000)

  it.skipIf(process.env.CONSOLE_DB_REQUIRED !== 'true')('proves scoped console failure, partial repair, unavailable captures, independent viewport failure and recurrence through Chromium and workers', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/console', other = origin + '/console-linked'
    try {
      await getAuditTaskQueue('browser').resume()
      const sourceCaptures = await Promise.all([pageUrl, other].map(url => captureScreenshots(url, 'console-source', undefined,
        { runFlow: false, captureMedia: false, consoleObservationMs: 5000, deadline: Date.now() + 12_000 })))
      const flags = sourceCaptures.flatMap((snapshot, index) => {
        expect(snapshot.consoleErrors.map(error => error.text).sort()).toEqual(['Console failure 0', 'Console failure 1', 'Unhandled page failure'])
        expect(snapshot.consoleCoverage).toMatchObject({ phase: 'page_load', desktop: { complete: true, errors: 3 }, mobile: { complete: true, errors: 3 } })
        return runConsoleChecks(snapshot.consoleErrors, snapshot.consoleCoverage).map(flag => ({ ...flag, pageUrl: [pageUrl, other][index] }))
      })
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', reviewDepth: 2,
        startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: { version: 1, engine: 'progressive-v1',
          targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: { 'console-errors-critical': 1, 'console-errors-some': 1 }, outcomes: [], verificationTarget: null } } })
      await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'console-errors-critical' } })
      expect(flag.affectedPaths).toEqual([pageUrl, other])
      expect(flag.evidenceTargets).toHaveLength(4)
      let attemptId = ''
      async function fix(phase: string) {
        attemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'console-fix:' + phase,
          changeSummary: 'Resolve the observed browser errors on every affected page' })).attemptId
      }
      async function verify(phase: string) {
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'console-verify:' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: 'console-errors-critical', parentAuditId: source.id, attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })
        expect(readExecutionSpec(audit.executionSpec)?.consoleObservationMs).toBeGreaterThanOrEqual(4400)
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } } })).map(task => task.workKind).sort())
          .toEqual(['browser', 'browser', 'check', 'check', 'finalize'])
        return run
      }
      await fix('unrepaired')
      const remaining = await verify('unrepaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: remaining.auditId!, targetKey: 'check:console-errors-critical' } })).detail))
        .toMatchObject({ verdict: 'failed', source: 'browser-console' })
      consoleRootErrors = 0; consoleLinkedErrors = 1; consoleDelayMs = 0
      await fix('partial'); await verify('partial')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      consoleRootErrors = 3; consoleLinkedErrors = 0; consoleDesktopUnavailable = true
      await fix('desktop-unavailable'); const independent = await verify('desktop-unavailable')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: independent.auditId!, targetKey: 'task:p0:browser' } })
      expect(readArtifact(browser.workResult, 'browser').data).toMatchObject({ metadata: null,
        snapshot: { consoleCoverage: { desktop: { complete: false }, mobile: { complete: true, errors: 3 } } } })
      expect(await prisma.flag.findFirst({ where: { auditId: independent.auditId!, checkId: 'console-errors-critical' } })).not.toBeNull()
      consoleRootErrors = 0; consoleDesktopUnavailable = false; consoleMobileUnavailable = true
      await fix('mobile-unavailable'); const unavailable = await verify('mobile-unavailable')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unavailable.auditId!, targetKey: 'check:console-errors-critical' } })).toBeNull()
      consoleMobileUnavailable = false; consoleRedirected = true
      await fix('redirect'); const redirected = await verify('redirect')
      const redirectedBrowser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: redirected.auditId!, targetKey: 'task:p0:browser' } })
      expect(readArtifact(redirectedBrowser.workResult, 'browser').data.snapshot).toMatchObject({ consoleCoverage: {
        desktop: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 },
        mobile: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 },
      } })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      consoleRedirected = false
      await fix('repaired'); const repaired = await verify('repaired')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      consoleRootErrors = 3; consoleLinkedErrors = 3; consoleDelayMs = 3500
      await getAuditTaskQueue('provider').pause()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'console-recurrence' })
      // Discovery follows completed observations of both viewports. It cannot
      // be required before their observation horizons have elapsed.
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, workKind: 'discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 100 }).catch(async error => {
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: recurrence.auditId!, targetKey: { startsWith: 'task:' }, workState: { notIn: ['COMPLETED', 'FAILED', 'BLOCKED'] } },
          select: { targetKey: true, workState: true, workErrorCode: true } })
        throw new Error('Console recurrence remained unfinished: ' + JSON.stringify(tasks), { cause: error })
      })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'console-errors-critical' }, include: { improvementOccurrence: true } })
      expect(repeated.status).toBe('REGRESSED')
      expect(repeated.improvementOccurrence).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
    } finally {
      consoleRootErrors = 3; consoleLinkedErrors = 3; consoleDelayMs = 3500
      consoleDesktopUnavailable = false; consoleMobileUnavailable = false; consoleRedirected = false; consoleFlood = false
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume(); transport.mockRestore()
    }
  }, 180_000)

  it.skipIf(process.env.CONSOLE_DB_REQUIRED !== 'true')('bounds real browser console floods without certifying a truncated observation', async () => {
    const transport = fixtureTransport()
    consoleFlood = true
    try {
      const captured = await captureScreenshots(origin + '/console', 'console-flood', undefined, { runFlow: false, captureMedia: false, deadline: Date.now() + 10_000 })
      expect(captured.consoleErrors).toHaveLength(500)
      expect(captured.consoleCoverage).toMatchObject({ messagesTruncated: true, desktop: { complete: false }, mobile: { complete: false } })
      expect(runConsoleChecks(captured.consoleErrors, captured.consoleCoverage)[0].problem).toBe('At least 500 JavaScript console errors detected')
    } finally { consoleFlood = false; transport.mockRestore() }
  }, 15_000)

  it.skipIf(process.env.CONSOLE_DB_REQUIRED !== 'true')('observes the complete console horizon after a delayed client navigation', async () => {
    const transport = fixtureTransport()
    consoleRedirected = true; consoleRedirectDelayMs = 2500; consoleRootErrors = 0
    try {
      const captured = await captureScreenshots(origin + '/console', 'console-delayed-navigation', undefined,
        { runFlow: false, captureMedia: false, consoleObservationMs: 5000, deadline: Date.now() + 12_000 })
      expect(captured.consoleCoverage).toMatchObject({ desktop: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 },
        mobile: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 } })
      expect(captured.consoleCoverage!.desktop.observedMs).toBeGreaterThanOrEqual(5000)
      expect(captured.consoleCoverage!.mobile.observedMs).toBeGreaterThanOrEqual(5000)
    } finally { consoleRedirected = false; consoleRedirectDelayMs = 0; consoleRootErrors = 3; transport.mockRestore() }
  }, 15_000)

  it.skipIf(process.env.PUBLIC_TRUST_DB_REQUIRED !== 'true')('proves public trust failures, independent fixes, unavailable evidence and recommendation recurrence through Chromium and the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/trust'
    const repairedRuns: string[] = []
    try {
      await getAuditTaskQueue('browser').resume()
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, deadline: Date.now() + 8000 })
      let metadata
      try { metadata = parseMetadataFromHtml(await session.page.content(), pageUrl) }
      finally { session.disposeNetwork(); await session.page.context().close() }
      const flags = runTrustChecks(pageUrl, metadata).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['no-privacy-policy', 'no-contact-info', 'cookie-consent-absent'])
      // Historical source observations come from Chromium and the real parser
      // and detector. Every subsequent fix uses application admission and workers.
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
        reportCompleteness: 'PARTIAL', htmlMetadata: metadata as never, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { 'no-privacy-policy': 1, 'no-contact-info': 1, 'cookie-consent-absent': 1 }, outcomes: [], verificationTarget: null } } })
      await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      const attempts = new Map<string, string>()
      async function fix(checkId: string, phase: string) {
        const flag = findings.find(flag => flag.checkId === checkId)!
        const result = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'trust-fix:' + phase,
          changeSummary: 'Restore the public trust signals on this page' })
        attempts.set(checkId, result.attemptId)
        return result.attemptId
      }
      for (const flag of findings) await fix(flag.checkId!, 'initial:' + flag.checkId)
      async function verify(checkId: string, phase: string) {
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'trust-verify:' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId, parentAuditId: source.id, attemptId: attempts.get(checkId)! } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
        return run
      }
      const privacy = findings.find(flag => flag.checkId === 'no-privacy-policy')!, contact = findings.find(flag => flag.checkId === 'no-contact-info')!
      const consent = findings.find(flag => flag.checkId === 'cookie-consent-absent')!
      const stillMissing = await verify('no-privacy-policy', 'unrepaired')
      expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: stillMissing.auditId!, targetKey: 'check:no-privacy-policy' } })).detail)).toMatchObject({ verdict: 'failed' })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get('no-privacy-policy')! } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      trustUnavailable = true
      const unavailable = await verify('cookie-consent-absent', 'unavailable')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get('cookie-consent-absent')! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: consent.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unavailable.auditId!, targetKey: 'check:cookie-consent-absent' } })).toBeNull()
      trustUnavailable = false; trustAnalytics = false
      await fix('cookie-consent-absent', 'analytics-unobserved')
      const unobservedAnalytics = await verify('cookie-consent-absent', 'analytics-unobserved')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get('cookie-consent-absent')! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: consent.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unobservedAnalytics.auditId!, targetKey: 'check:cookie-consent-absent' } })).toBeNull()
      trustAnalytics = true; trustContact = true
      const contactRun = await verify('no-contact-info', 'contact-only')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({ status: 'FIXED', resolvedInId: contactRun.auditId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: privacy.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: consent.id } })).toMatchObject({ status: 'OPEN' })
      trustPrivacy = true; trustConsent = true; trustConsoleErrors = true
      for (const checkId of ['no-privacy-policy', 'cookie-consent-absent']) {
        await fix(checkId, 'repaired:' + checkId)
        const repaired = await verify(checkId, 'repaired:' + checkId)
        repairedRuns.push(repaired.auditId!)
        const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, targetKey: 'module:trust' } })
        expect(receipt.detail).toMatchObject({ passed: true, assertions: expect.arrayContaining([expect.objectContaining({ passed: true })]) })
        const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, workKind: 'browser' } })
        expect(readArtifact(browser.workResult, 'browser').data.snapshot).toMatchObject({ consoleErrors: expect.arrayContaining([expect.objectContaining({ text: 'Unrelated first error' })]) })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get(checkId)! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: repaired.auditId })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: findings.find(flag => flag.checkId === checkId)!.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, targetKey: 'check:' + checkId } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
      }
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: privacy.id } })
      trustPrivacy = false; trustConsoleErrors = false
      await getAuditTaskQueue('provider').pause()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'trust-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.count({ where: { auditId: recurrence.auditId!, workKind: 'search' } })).toBeGreaterThan(0)
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'no-privacy-policy' }, include: { improvementOccurrence: true } })
      expect(repeated.status).toBe('REGRESSED')
      expect(repeated.improvementOccurrence).toMatchObject({ improvementId: original.improvementId, kind: 'REGRESSED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: privacy.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repairedRuns[0] })
      const site = await loadSiteRecord(projectId)
      expect((await loadSiteFlags(site!)).some(flag => flag.checkId === 'no-privacy-policy')).toBe(false)
      expect(await loadSiteRecommendations(site!)).toEqual(expect.arrayContaining([expect.objectContaining({
        improvementId: original.improvementId, sourceFlagId: repeated.id, checkId: 'no-privacy-policy',
      })]))
    } finally {
      trustPrivacy = false; trustContact = false; trustConsent = false; trustUnavailable = false; trustConsoleErrors = false; trustAnalytics = true
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume(); transport.mockRestore()
    }
  }, 75_000)

  it.skipIf(process.env.SCHEDULED_SITE_CARE_REQUIRED !== 'true')('refreshes broad Site evidence and bound incidents through scheduled care, then reuses fresh evidence for uptime', async () => {
    releaseResources()
    const transport = fixtureTransport()
    const originalProject = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const pageUrl = origin + '/monitored', tick = new Date()
    const audits: string[] = []
    const comparisons: FlagDiffSummary[] = []
    let titleFlagId = '', titleImprovementId = '', titleAttemptId = '', availabilityFlagId = ''
    let titleFailureState: { status: string; resolvedInId: string | null } | undefined
    try {
      await prisma.project.update({ where: { id: projectId }, data: { url: pageUrl } })
      await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
      // In isolation the default points at the new Site target. Use the explicit
      // public root dependency so availability and page diagnostics vary independently.
      const availability = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' }, include: { bindings: true } })
      await prisma.outcomeExecutionBinding.update({ where: { id: availability.bindings[0].id }, data: { config: { startUrl: origin + '/', expectedSelector: 'body' } } })
      for (const [index, state] of [503, 'challenge', 200, 503].entries()) {
        monitoredTitleMissing = index === 0 || index === 3
        monitoredUnavailable = index === 1
        availabilityStatus = typeof state === 'number' ? state : 200
        availabilityChallenged = state === 'challenge'
        const scheduledAt = new Date(tick.getTime() + index * 7 * 24 * 60 * 60 * 1000)
        await getAuditTaskQueue('provider').pause()
        const run = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt, now: scheduledAt })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.count({ where: { auditId: run.auditId!, workKind: 'search' } })).toBeGreaterThan(0)
        }, { timeout: 10_000, interval: 100 })
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(run.auditId!))
        await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 100 })
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })
        expect(readExecutionSpec(audit.executionSpec)).toMatchObject({ scope: 'SITE', outcomes: expect.arrayContaining([expect.objectContaining({ id: availability.id })]) })
        expect(audit.reportCompleteness).toBe('PARTIAL')
        const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'module:search-presentation' } })
        expect(searchArtifactSchema.shape.receipt.parse(receipt.detail).observations).toEqual(expect.arrayContaining([
          expect.objectContaining({ checkId: 'title-missing', disposition: monitoredUnavailable ? 'unknown' : monitoredTitleMissing ? 'failed' : 'passed' }),
        ]))
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: run.runId, outcomeId: availability.id } } })
        expect(assessment.state).toBe(state === 503 ? 'FLAG' : state === 'challenge' ? 'COULD_NOT_VERIFY' : 'CLEAR')
        const summary = await getFlagDiffSummary(audit.parentId, audit.id)
        comparisons.push(summary)
        if (index === 0) {
          const title = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'title-missing' }, include: { improvementOccurrence: true } })
          titleFlagId = title.id; titleImprovementId = title.improvementOccurrence!.improvementId
          expect(['OPEN', 'REGRESSED']).toContain(title.status)
          expect(title.resolvedInId).toBeNull()
          titleFailureState = { status: title.status, resolvedInId: title.resolvedInId }
          availabilityFlagId = (await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, fingerprint: { startsWith: 'outcome:v1:' + availability.id + ':' } } })).id
          titleAttemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: title.id, userId,
            idempotencyKey: 'scheduled-title-fix', changeSummary: 'Restore the title on this page' })).attemptId
        }
        if (index === 1) {
          const unavailable = await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.id, workErrorCode: 'PAGE_HTTP_ERROR' } })
          expect(unavailable.length).toBeGreaterThan(0)
          expect(unavailable.every(task => task.workState === 'BLOCKED' && task.status === 'FAILED' && task.workAttempts === 1)).toBe(true)
          expect(await prisma.auditPipelineEvent.findMany({ where: { auditId: audit.id, event: 'page_response_unavailable' }, select: { detail: true } })).toEqual(
            expect.arrayContaining([expect.objectContaining({ detail: expect.objectContaining({ httpStatus: 503, code: 'HTTP_ERROR', finalUrl: pageUrl }) })]))
          expect(summary.inconclusive.map(flag => flag.id)).toContain(titleFlagId)
          expect(summary.inconclusive.map(flag => flag.id)).toContain(availabilityFlagId)
          // Earlier observations may already establish recurrence. Missing
          // evidence preserves the exact active state instead of rewriting it.
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: titleFlagId } })).toMatchObject(titleFailureState!)
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: availabilityFlagId } })).toMatchObject({ status: expect.not.stringMatching('FIXED') })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: titleAttemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        }
        if (index === 2) {
          expect(summary.fixed.map(flag => flag.id)).toContain(titleFlagId)
          expect(summary.fixed.map(flag => flag.id)).toContain(availabilityFlagId)
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: titleFlagId } })).toMatchObject({ status: 'FIXED', resolvedInId: audit.id })
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: availabilityFlagId } })).toMatchObject({ status: 'FIXED', resolvedInId: audit.id })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: titleAttemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        }
        if (index === 3) {
          expect(summary.regressed.some(flag => flag.checkId === 'outcome-availability-failed')).toBe(true)
          expect(summary.regressed.some(flag => flag.checkId === 'title-missing')).toBe(true)
          const title = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'title-missing' }, include: { improvementOccurrence: true } })
          expect(title.improvementOccurrence!.improvementId).toBe(titleImprovementId)
          expect(title).toMatchObject({ status: 'REGRESSED' })
          expect(title.improvementOccurrence!.kind).toBe('REGRESSED')
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: titleFlagId } })).toMatchObject({ status: 'FIXED', resolvedInId: audits[2] })
          const replay = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt, now: new Date() })
          expect(replay).toMatchObject({ auditId: audit.id, reused: true })
        }
      }
      const frequent = await requestScheduledSiteRun({ projectId, userId, interval: 'hourly', scheduledAt: new Date(tick.getTime() + 60 * 60 * 1000), now: new Date() })
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: frequent.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: frequent.auditId!, workKind: { not: null } } })
      expect(tasks.every(task => task.workKind === 'bindings' || task.workKind === 'finalize')).toBe(true)
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: frequent.auditId! } })).executionSpec)?.scope).toBe('OUTCOMES')
      for (const [index, auditId] of audits.entries()) {
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
        expect(await getFlagDiffSummary(audit.parentId, auditId)).toEqual(comparisons[index])
        expect(await prisma.auditVerifierExecution.count({ where: { auditId, targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product' } })).toBe(1)
      }
      expect(comparisons[0].newIssues).toEqual(expect.arrayContaining([expect.objectContaining({ id: titleFlagId, status: 'OPEN' })]))
      expect(comparisons[1].inconclusive.map(flag => flag.id)).toContain(titleFlagId)
      const first = await prisma.audit.findUniqueOrThrow({ where: { id: audits[0] } })
      // This isolated process has no email provider. Reclassification after the
      // later recovery must still retain the original alert facts and retry state.
      await notifyWatchRegression(first.parentId, first.id)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
        watchRegressionCount: first.watchRegressionCount, watchRecoveryCount: first.watchRecoveryCount,
        watchNotificationStatus: 'FAILED',
      })
    } finally {
      await prisma.project.update({ where: { id: projectId }, data: { url: originalProject.url } })
      availabilityStatus = 200; availabilityChallenged = false; monitoredTitleMissing = true; monitoredUnavailable = false
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume(); transport.mockRestore()
    }
  }, 90_000)

})
