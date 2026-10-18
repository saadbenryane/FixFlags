import { CHECK_REGISTRY } from '../../check-registry'
import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { Worker as ParserWorker } from 'node:worker_threads'
import type { Route } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { retryAudit } from '@/lib/audit/retry-audit'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { SECTION_LINK_VERIFICATION_RULE } from '@/lib/audit/checks/section-links'
import { authorizeOutcomeFixture, listOutcomeFixtures } from '@/lib/sites/application/outcome-fixtures'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, readWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, getBrowserDiagnostics, closeBrowser, captureScreenshots } from '@/lib/audit/screenshot'
import { encryptSecret } from '@/lib/security/crypto'
import { reconcileTasks, dispatchReadyTasks } from '../engine'
import { searchArtifactSchema } from '../evaluators'
import { searchVerifierSchema } from '@/lib/audit/search/contracts'
import { readArtifact, serializeArtifact } from '../contracts'
import { executionWrite, withExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import { SEARCH_LOCAL_MODULES } from '@/lib/audit/search/workflow'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { applyJourneyRouteGuards } from '@/lib/audit/browser/journey-safety'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { classifyTrackingEndpoint } from '@/lib/audit/tracking/endpoints'
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { projectCheckResults } from '@/lib/sites/check-results'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { classifyWatchResult, notifyWatchRegression, retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import { fetchPageSpeedData } from '@/lib/audit/pagespeed'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { runMobileChecks } from '@/lib/audit/checks/mobile'
import { persistControlledNativeSource } from './controlled-native-source'
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
import { loadSiteFlags, loadSiteRecommendations } from '@/lib/sites/flags'
import { runConsoleChecks } from '@/lib/audit/checks/console'
import { runAllChecks } from '@/lib/audit/checks'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { PRIMARY_ACTION_VERIFICATION_RULE, PRIMARY_ACTION_CHECKS } from '@/lib/audit/flow/primary-action-evidence'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { runJourneyTemplate } from '@/lib/audit/journey/run-template'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { createOverlayInteractionRecorder } from '@/lib/audit/browser/overlay-interaction'
import { runFlowScan, type FlowScanResult } from '@/lib/audit/flow/run-flow-scan'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { POST_CLICK_VERIFICATION_RULE } from '@/lib/audit/checks/flow-post-click'
import { Resend } from 'resend'
import { watchAlertDelivery } from '@/lib/audit/watch-notification'
import { watchEmailPayloadSchema } from '@/lib/email/watch-payload'
import { watchEmailProviderBody } from '@/lib/email/watch-delivery'
import { NextRequest } from 'next/server'
import { POST as handleMcpPost } from '@/app/api/mcp/route'
import { generateApiKey } from '@/lib/security/api-keys'
import { getAppUrl } from '@/lib/get-app-url'
import { MCP_PROTOCOL_VERSION, MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { runSlowReplay } from '@/lib/audit/flow/slow-replay-probe'
import { runSlowReplayChecks } from '@/lib/audit/checks/slow-replay'
import { runInteractionChecks } from '@/lib/audit/checks/interaction'
import { runMobileUXQualityChecks } from '@/lib/audit/checks/mobile-ux-quality'
import { slowReplayResultSchema } from '@/lib/audit/flow/slow-replay-contract'
import { MOTION_VERIFICATION_RULE, motionAssertions } from '@/lib/audit/checks/motion-evidence'
import { collectOverlayObservation } from '@/lib/audit/browser/overlay-observation'
import { runObservedOverlayChecks, overlayAssertions, OVERLAY_VERIFICATION_RULE, scopedOverlayResult } from '@/lib/audit/checks/overlay-evidence'
import { JOURNEY_VERIFICATION_RULE, nativeJourneyFlags } from '@/lib/audit/checks/journey-evidence'
import { collectMobileNavigation } from '@/lib/audit/flow/mobile-navigation'
import { mobileNavigationFlags, MOBILE_NAVIGATION_RULE } from '@/lib/audit/flow/mobile-navigation-evidence'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { auditPageObservation } from '@/lib/audit/browser/observation-scope'
import { persistProjectScanAccess } from '@/lib/audit/scan-access-store'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import { probeUptime } from '@/lib/uptime/probe'
import { keyboardEvidenceSchema } from '@/lib/audit/browser/keyboard-probe'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import type { CaptureMetrics } from '@/lib/audit/capture-metrics'
import * as screenshotStorage from '@/lib/storage/screenshots'
import * as integrityStorage from '@/lib/integrity/storage'
import { uploadScreenshot as uploadToS3 } from '@/lib/storage/r2'
import { StorageUploadError } from '@/lib/audit/pipeline-errors'

const externalQueues = ['provider', 'pagespeed', 'google'] as const
async function pauseExternalQueues() { await Promise.all(externalQueues.map(resource => getAuditTaskQueue(resource).pause())) }
async function resumeExternalQueues() { await Promise.all(externalQueues.map(resource => getAuditTaskQueue(resource).resume())) }

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
  let componentKeyboard: 'failed' | 'partial' | 'closed' | 'healthy' = 'failed'
  let inputSizing: 'failed' | 'removed' | 'changed' | 'expanded' = 'failed'
  let actionHierarchy: 'competing' | 'secondary' | 'complex' = 'competing'
  let actionHierarchyBound: 'none' | 'bytes' | 'records' = 'none'
  let restorationRepaired = false
  let trackingRepaired = false
  let trackingEnabled = true
  let trackingProject = 'PRIVATE_ORIGINAL'
  let trackingActionProject = 'PRIVATE_ORIGINAL'
  let structuredPhase: 'failed' | 'changed' | 'repaired' = 'failed'
  let destinationsRepaired = false
  let destinationBasePath = '/nested/'
  let destinationLarge = false
  let independentActions: 'failed' | 'missing' | 'healthy' = 'failed'
  let independentInventoryBound = false
  let publicLinksMode: 'failed' | 'blocked' | 'removed' | 'healthy' = 'failed'
  let sectionLinksMode: 'failed' | 'partial' | 'inert' | 'challenge' | 'changed' | 'removed' | 'healthy' = 'failed'
  let primaryActionMode: 'failed' | 'blocked' | 'challenge' | 'competing' | 'changed' | 'removed' | 'healthy' = 'failed'
  let primaryControlMode: 'missing' | 'disabled' | 'deadend' | 'healthy' = 'missing'
  let primaryControlDeclared = true
  let primaryControlKind: 'button' | 'link' | 'role' | 'input-button' | 'input-submit' = 'button'
  let availabilityChallenged = false
  let availabilityStatus = 200
  let checkoutJourneyHealthy = false
  let otherAvailabilityStatus = 200
  let signupMode: 'success' | 'missing' | 'preexisting' = 'success'
  let signupCleanupOk = true
  let signupSubmissions = 0
  let pageSpeedMode: 'failed' | 'missing' | 'healthy' | 'different-resources' | 'refused' | 'failed-vitals' | 'missing-vitals' | null = null
  let mobileResourceMode: 'failed' | 'missing' | 'different' | 'healthy' | null = null
  let resourcePeerCriteria = false
  let resourceImageMode: 'original' | 'partial-failed' | 'partial-healthy' | 'different-failure' | 'healthy' | null = null
  let mobileTapMode: 'failed' | 'missing' | 'different' | 'healthy' | null = null
  let performanceScopeMode: 'original' | 'engine' | 'redirect' | 'profile' | 'missing' = 'original'
  let publicFormMode: 'broken' | 'blocked' | 'socket' | 'peer' | 'popup' | 'hidden' | 'unrelated' | 'outside' | 'slow' | 'healthy' | 'native' | 'prefilled' = 'broken'
  let publicFormSubmissions = 0
  let formInventoryCount = 7
  let literalIdsRepaired = false
  let headerMode: 'failed' | 'partial' | 'challenge' | 'forbidden' | 'rate-limited' | 'redirected' | 'healthy' = 'failed'
  let transportMode: 'http' | 'https' | 'unavailable' = 'http'
  let headerTitleMissing = false
  let headerPolicyOverrides: Record<string, string> | null = null
  let slowReplayMode: 'delayed' | 'healthy' | 'challenge' | 'competing' = 'delayed'
  let loadingUiClearMs: number | null = 1000
  let loadingUiDesktopMs: number | null | undefined
  let loadingUiMode: 'page' | 'blank' | 'challenge' | 'desktop-challenge' = 'page'
  let motionMode: 'ignored' | 'honored' | 'mixed' | 'paused' | 'hidden' | 'intro' | 'script-ignored' | 'script-honored' | 'transition-ignored' | 'transition-honored' | 'padding' | 'blank' | 'challenge' = 'ignored'
  let publicFormExternal = false
  let metadataPresenceMode: 'missing' | 'healthy' | 'incomplete' | 'healthy-large' | 'unavailable' | 'oversized' = 'missing'
  let parserFixtureRepaired = false
  let parserFixtureHeaders = false
  let overlayMode: 'covered' | 'healthy' | 'desktop-healthy' | 'transient' | 'consent' | 'hidden' | 'blank' | 'challenge' | 'hover-primary' | 'hover-navigation' | 'hover-form' = 'covered'
  let journeyMode: 'missing' | 'hidden' | 'reranked' | 'disabled' | 'changed' | 'blank' | 'challenge' | 'healthy' = 'missing'
  let journeySubmissions = 0
  let journeyCtaMode: 'missing' | 'hidden' | 'visible' = 'visible'
  let postClickDelayMs = 3300
  let postClickEarly = false
  let pricingMode: 'broken' | 'healthy' | 'missing' | 'changed' | 'competing' | 'challenge' | 'redirect' = 'broken'
  let postClickReplayMode: 'normal' | 'missing' | 'changed' | 'competing' | 'challenge' | 'blank' | 'redirect' = 'normal'
  const postClickPendingRoutes = new Set<Route>()
  let mobileNavigationMode: 'missing' | 'noop' | 'removed' | 'changed' | 'blank' | 'challenge' | 'healthy' = 'missing'
  let monitoredTitleMissing = true
  let monitoredUnavailable = false
  let monitoredChallenge: 'header' | 'title' | null = null
  let trustHydration: 'none' | 'data' | 'dom' = 'none'
  let trustPrivacy = false, trustContact = false, trustConsent = false, trustUnavailable = false, trustConsoleErrors = false, trustAnalytics = true
  let consoleRootErrors = 3, consoleLinkedErrors = 3, consoleDelayMs = 3500
  let consoleDesktopUnavailable = false, consoleMobileUnavailable = false, consoleRedirected = false, consoleFlood = false
  let consoleRedirectDelayMs = 0
  let accessibilityNames = false, accessibilityOtherNames = false, accessibilityContrast = false, accessibilityAria = false
  let structureHealthy = false, structureUnavailable = false
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
    if (req.url === '/pricing-navigation') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><title>Project planning</title><header><nav>' +
        (pricingMode === 'competing' ? '<a id="other-pricing" href="/pricing-page-other">Pricing</a>' : '') +
        (pricingMode === 'missing' ? '' : '<a id="original-pricing" href="' + (pricingMode === 'changed' ? '/pricing-page-other' : '/pricing-page') + '">Pricing</a>') +
        '</nav></header><main><h1>Useful project planning for your team</h1><p>Organize projects and work with your team.</p><a id="start" href="#start-step">Get started</a><section id="start-step" style="height:150px">Create your first project.</section></main>')
    } else if (req.url === '/pricing-page' || req.url === '/pricing-page-other' || req.url === '/navigation-home') {
      res.setHeader('content-type', 'text/html')
      if (req.url === '/pricing-page' && pricingMode === 'redirect') { res.end('<!doctype html><title>Planning</title><script>location.replace("/navigation-home")</script>'); return }
      if (req.url === '/pricing-page' && pricingMode === 'challenge') { res.setHeader('cf-mitigated', 'challenge'); res.end('<!doctype html><title>Just a moment...</title><h1>Verify you are human</h1>'); return }
      const failed = req.url === '/pricing-page' && pricingMode !== 'healthy'
      res.statusCode = failed ? 503 : 200
      res.end('<!doctype html><title>Planning service</title><main><h1>' + (failed ? 'Service unavailable' : req.url === '/navigation-home' ? 'Welcome to our service' : 'Plans for your team') + '</h1><p>Useful information for your whole team.</p></main>')
    } else if (req.url === '/mobile-navigation') {
      res.setHeader('content-type', 'text/html')
      if (mobileNavigationMode === 'challenge') { res.setHeader('cf-mitigated', 'challenge'); res.end('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'); return }
      if (mobileNavigationMode === 'blank') { res.end('<html><head><title>Website</title></head><body></body></html>'); return }
      const links = Array.from({ length: mobileNavigationMode === 'removed' ? 5 : 6 }, (_, index) => '<a href="/mobile-feature-' +
        (mobileNavigationMode === 'changed' && index === 0 ? 'different' : index) + '">Feature ' + index + '</a>').join('')
      res.end('<html><head><title>Useful website service</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><header>' +
        (mobileNavigationMode === 'missing' ? '' : '<button type="button" id="mobile-opener" aria-controls="mobile-panel" aria-expanded="false">Menu</button>') +
        '<nav id="mobile-panel" aria-label="Main" hidden>' + links + '</nav></header><main><h1>Useful service for teams</h1><p>Choose the feature you need to keep your website working.</p></main>' +
        '<script>document.getElementById("mobile-opener")?.addEventListener("click",()=>{' +
        (mobileNavigationMode === 'noop' ? '' : 'const panel=document.getElementById("mobile-panel");panel.hidden=!panel.hidden;document.getElementById("mobile-opener").setAttribute("aria-expanded",String(!panel.hidden));') +
        '})</script></body></html>')
    } else if (req.url === '/post-click-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><title>Useful team planning</title><main><h1>Plan projects with your team</h1><p>Choose the next step for your team.</p>' +
        (postClickReplayMode === 'competing' ? '<a id="competing-post-click" href="/post-click-other">Get started free</a>' : '') +
        (postClickReplayMode === 'missing' ? '' : '<a id="post-click-primary" href="' + (postClickReplayMode === 'changed' ? '/post-click-other' : '/post-click-destination') + '">Get started</a>') + '</main>')
    } else if (req.url === '/post-click-other') {
      res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Other destination</title><main><h1>Another useful service</h1><p>Choose an available next step.</p><button>Continue</button></main>')
    } else if (req.url === '/post-click-destination') {
      res.setHeader('content-type', 'text/html')
      if (postClickReplayMode === 'redirect') { res.writeHead(302, { location: '/post-click-other' }); res.end(); return }
      if (postClickReplayMode === 'challenge') { res.setHeader('cf-mitigated', 'challenge'); res.end('<!doctype html><title>Just a moment...</title><h1>Verify you are human</h1>'); return }
      if (postClickReplayMode === 'blank') { res.end('<!doctype html><title>Team planning</title><main></main>'); return }
      res.end('<!doctype html><title>Start team planning</title><script defer src="/post-click-script.js"></script><main>' +
        (postClickEarly ? '<h1>Start using our useful service</h1><p>Plan projects with your whole team.</p>' : '<div class="spinner" style="width:200px;height:200px">Loading account</div>') + '</main>')
    } else if (req.url === '/post-click-script.js') {
      await new Promise(resolve => setTimeout(resolve, postClickDelayMs))
      res.setHeader('content-type', 'application/javascript')
      res.end('document.querySelector("main").innerHTML="<h1>Start using our useful service</h1><p>Plan projects with your whole team.</p><button>Continue</button><footer><a href=\\\"/privacy\\\">Privacy policy</a><a href=\\\"mailto:support@example.com\\\">Contact support</a></footer>"')
    } else if (req.url === '/journey-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html><head><title>Useful service for teams</title></head><body><nav hidden>' + '<a href="/journey-signup">Get started</a>'.repeat(85) + '</nav><main><h1>Useful service for teams</h1><p>Choose a public signup path to get started.</p>' +
        (journeyMode === 'reranked' || journeyMode === 'disabled' ? '<a id="other-signup" href="' + (journeyMode === 'disabled' ? '/journey-signup' : '/journey-other-signup') + '">Get started free</a>' : '') +
        (journeyCtaMode === 'missing' ? '' : '<a id="signup-entry"' + (journeyCtaMode === 'hidden' ? ' hidden' : '') + (journeyMode === 'disabled' ? ' aria-disabled="true"' : '') + ' href="' + (journeyMode === 'changed' ? '/journey-other-signup' : '/journey-signup') + '">Get started</a>') + '</main></body></html>')
    } else if (req.url === '/journey-signup' || req.url === '/journey-other-signup') {
      res.setHeader('content-type', 'text/html')
      if (journeyMode === 'challenge') res.setHeader('cf-mitigated', 'challenge')
      const form = journeyMode === 'healthy' || journeyMode === 'hidden' || journeyMode === 'disabled' || req.url === '/journey-other-signup'
        ? '<div' + (journeyMode === 'hidden' ? ' hidden' : '') + '><form action="/journey-submit" method="post"><label>Email <input type="email" name="email"></label><button type="submit">Create account</button></form></div>' : ''
      res.end('<!doctype html><html><head><title>Signup for our service</title></head><body><main>' +
        (journeyMode === 'blank' ? '' : '<h1 hidden>Verify you are human</h1><div style="visibility:hidden"><h1 style="visibility:visible">Start using our useful service</h1></div><p>Review the information you need to create your account.</p>' + form) + '</main></body></html>')
    } else if (req.url === '/journey-submit') {
      journeySubmissions++; res.end('Account created')
    } else if (req.url === '/performance-fixture') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Useful information about our service</title>' +
        '<meta name="description" content="Read clear information about our service and the next steps available to you.">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="' + origin + '/performance-fixture"></head>' +
        '<body><main><h1>Useful information about our service</h1><p>Read how our service helps you manage your work and decide what to do next.</p>' +
        '<a href="#details">Learn more</a><section id="details"><h2>How the service works</h2><p>Review clear information about the service before choosing your next step.</p></section></main></body></html>')
    } else if (req.url === '/primary-control') {
      res.setHeader('content-type', 'text/html')
      const declared = primaryControlDeclared ? ' aria-controls="completion"' : ''
      const control = primaryControlKind === 'button' ? '<button id="primary-action"' + declared + (primaryControlMode === 'disabled' ? ' disabled' : '') + '>Get started</button>'
        : primaryControlKind === 'role' ? '<div id="primary-action" role="button"' + declared + (primaryControlMode === 'disabled' ? ' aria-disabled="true"' : '') + '>Get started</div>'
          : primaryControlKind.startsWith('input-') ? '<input id="primary-action" type="' + primaryControlKind.slice(6) + '" value="Get started"' + declared + (primaryControlMode === 'disabled' ? ' disabled' : '') + '>'
          : '<a id="primary-action"' + declared + ' href="/primary-control-target">Get started</a>'
      res.end('<!doctype html><html lang="en"><head><title>Useful service for teams</title></head><body><main><h1>Useful service for teams</h1><p>Choose your next step.</p>' +
        '<section style="opacity:0"><a href="/pricing">Pricing</a></section><section inert><a href="/pricing">Pricing</a></section>' +
        (primaryControlMode === 'missing' ? '' : control) + '<div id="completion" hidden role="dialog" aria-label="Next step"><h2>Choose your next step</h2>' +
        '<form><label>Email<input type="email" required></label><button>Continue</button></form></div>' +
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
      res.end('<!doctype html><html lang="en"><head><title>' + label + '</title></head><body><main>' +
        (healthy ? '<h1 hidden>Verify you are human</h1>' : '') + '<h1>' + label + '</h1>' +
        (healthy ? '<a href="/primary-action">Review service details</a>' : '<div class="spinner" style="width:200px;height:200px">Loading account</div>') + '</main></body></html>')
    } else if (req.url === '/sections' || req.url === '/sections-peer') {
      const peer = req.url === '/sections-peer'
      if (sectionLinksMode === 'challenge') res.setHeader('cf-mitigated', 'challenge')
      res.setHeader('content-type', 'text/html')
      const target = peer ? 'café' : 'Pricing', repaired = sectionLinksMode === 'healthy' || sectionLinksMode === 'partial' && !peer
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + (sectionLinksMode === 'challenge' ? 'Just a moment...' : 'Useful service sections') + '</title></head>' +
        '<body><main><h1>Useful service sections</h1>' +
        (sectionLinksMode === 'removed' ? '' : '<a href="#' + (sectionLinksMode === 'changed' ? 'other' : encodeURIComponent(target)) + '">Section details</a>') +
        '<section id="' + (repaired ? target : 'other') + '"><h2>Section details</h2></section>' +
        (sectionLinksMode === 'inert' ? '<noscript><section id="' + target + '"></section></noscript><template><a name="' + target + '"></a></template>' : '') +
        '<noscript><a href="#fallback-only">Fallback</a></noscript><template><a href="#template-only">Template</a></template>' +
        '<a href="#Help%20center">Help</a><section id="Help center">Help information</section>' +
        '<a href="#Contact">Contact</a><a name="Contact">Contact information</a>' +
        (peer ? '' : '<a href="/sections-peer">Other information</a>') + '</main></body></html>')
    } else if (req.url === '/public-links' || req.url === '/public-links-peer') {
      const peer = req.url === '/public-links-peer'
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Public link fixture</title><base href="/resolved/"></head><body><main><h1>Public link fixture</h1>' +
        (publicLinksMode === 'removed' ? '' : '<a href="' + (peer ? 'public-links-other-gone' : 'public-links-gone') + '">Useful details</a>') +
        (peer ? '' : '<a href="/public-links-peer">Other information</a>') +
        '<noscript><a href="/inactive-fallback">Inactive fallback</a></noscript><template><a href="/inert-template">Inert template</a></template>' +
        '<div hidden>' + 'x'.repeat(1_100_000) + '</div></main></body></html>')
    } else if (req.url === '/resolved/public-links-gone' || req.url === '/resolved/public-links-other-gone') {
      res.statusCode = publicLinksMode === 'healthy' ? 200 : publicLinksMode === 'blocked' ? 429 : 404
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html><head><title>' + (publicLinksMode === 'healthy' ? 'Useful details' : 'Unavailable page') + '</title></head><body><h1>Useful details</h1></body></html>')
    } else if (req.url === '/structure' || req.url === '/structure-missing') {
      if (req.url === '/structure-missing' && structureUnavailable) { res.writeHead(503); res.end('Unavailable'); return }
      const missing = req.url === '/structure-missing'
      const header = '<header><nav aria-label="Primary"><a href="/structure-missing">More information</a></nav></header>'
      const controls = '<button id="option">First option</button><button id="' + (structureHealthy ? 'other-option' : 'option') + '">Second option</button>'
      const main = '<main id="main"><h1>Useful service information</h1><h2>How the service works</h2><h3>Getting started</h3><p>Review useful information for your team.</p>' + controls + '</main>'
      const footer = '<footer><p>Service information and contact details.</p></footer>'
      const failed = missing ? header + '<article id="main"><h1>More service information</h1><p>Read the next step.</p></article>' + footer
        : header + '<section role="region" aria-label="Service overview"><header role="banner"><p>Another service banner</p></header>' +
          '<main id="main"><h2>Useful service information</h2><h4>Getting started</h4><p>Review useful information for your team.</p>' + controls + '</main>' +
          '<footer role="contentinfo"><p>Service information and contact details.</p></footer></section>'
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Page structure fixture</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>body{background:white;color:black;font:18px Arial}a{display:inline-block;padding:12px}</style></head><body><a href="#main">Skip to content</a>' +
        (structureHealthy ? header + main + footer : failed) + '</body></html>')
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
        '</script>' + (trustHydration === 'data' ? '<script type="application/json" id="__NEXT_DATA__">' + JSON.stringify({ content: 'x'.repeat(1_100_000), analytics: 'googletagmanager', consent: 'cookie' }) + '</script>' : '') + '</head><body><main><h1>Useful website information</h1><p>Read useful information about our services.</p>' +
        (trustHydration === 'dom' ? '<p>' + 'x'.repeat(1_100_000) + '</p>' : '') +
        (trustPrivacy ? '<a href="/privacy">Privacy policy</a>' : '') + (trustContact ? '<a href="mailto:help@example.com">Email support</a>' : '') +
        (trustConsent ? '<aside id="cookie-settings"><button>Cookie settings</button></aside>' : '') + '</main></body></html>')
    } else if (req.url === '/overlay-observation') {
      res.setHeader('content-type', 'text/html')
      if (overlayMode === 'challenge') {
        res.setHeader('cf-mitigated', 'challenge'); res.end('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'); return
      }
      if (overlayMode === 'blank') { res.end('<html><head><title>Overlay fixture</title></head><body><main></main></body></html>'); return }
      res.end('<!doctype html><html lang="en"><head><title>Overlay fixture</title><style>' +
        'body{margin:16px}nav{height:40px}a{display:inline-block;padding:10px}form{margin-top:24px}input{display:block;margin:10px 0}button{padding:10px}' +
        '.overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000}</style></head><body>' +
        '<header><nav><a id="navigation" href="#details">Pricing</a></nav></header><main><h1>Useful website information</h1><p>Read about our services.</p>' +
        '<a id="original-action" href="/signup"' + (overlayMode === 'hidden' ? ' style="visibility:hidden"' : '') + '>Get started free</a>' +
        '<form><label for="email">Email address</label><input id="email" name="email" type="email" required><button id="submit" type="submit">Send request</button></form><section id="details">Pricing details</section>' +
        (['covered', 'transient', 'consent'].includes(overlayMode) || overlayMode === 'desktop-healthy' && /Mobile|Android|iPhone/i.test(String(req.headers['user-agent'])) ? '<aside id="cover" class="overlay" role="dialog">' +
          (overlayMode === 'consent' ? 'Cookie preferences<button>Accept</button><button>Reject</button>' : 'Advertisement without a dismiss control') + '</aside>' : '') +
        (overlayMode === 'transient' ? '<script>setTimeout(()=>document.getElementById("cover").remove(),950)</script>' : '') +
        (overlayMode.startsWith('hover-') ? '<script>document.getElementById(' + JSON.stringify(overlayMode === 'hover-primary' ? 'original-action' : overlayMode === 'hover-navigation' ? 'navigation' : 'submit') +
          ').addEventListener("pointerover",()=>{if(document.getElementById("cover"))return;const cover=document.createElement("aside");cover.id="cover";cover.className="overlay";cover.setAttribute("role","dialog");cover.textContent="Persistent advertisement after hover";document.body.append(cover)});</script>' : '') +
        '</main></body></html>')
    } else if (req.url === '/motion-observation') {
      res.setHeader('content-type', 'text/html')
      if (motionMode === 'challenge') {
        res.setHeader('cf-mitigated', 'challenge'); res.end('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'); return
      }
      if (motionMode === 'blank') { res.end('<html><head><title>Motion fixture</title></head><body><main></main></body></html>'); return }
      const scriptMotion = motionMode.startsWith('script-')
      const transitionMotion = motionMode.startsWith('transition-')
      res.end('<!doctype html><html lang="en"><head><title>Motion fixture</title><style>' +
        '@keyframes moving{from{transform:translateX(0)}to{transform:translateX(20px)}}' +
        '.moving{width:60px;height:60px;background:#000;animation:moving ' + (motionMode === 'intro' ? '1s 1' : '1s infinite') + ';}' +
        '.box{width:60px;height:60px;background:#000;transition:transform 1s}' +
        (motionMode === 'transition-honored' ? '@media(prefers-reduced-motion:reduce){.box{transition:none}}' : '') +
        (motionMode === 'honored' ? '@media(prefers-reduced-motion:reduce){.moving{animation:none}}' : '') +
        (motionMode === 'mixed' || motionMode === 'padding' ? '@media(prefers-reduced-motion:reduce){.honors{animation:none}}' : '') +
        (motionMode === 'paused' ? '.moving{animation-play-state:paused}' : '') +
        '</style></head><body><main><h1>Useful product information</h1><p>Read about our product and services.</p>' +
        (motionMode === 'mixed' ? '<section class="hero"><div id="honoring" class="moving honors"></div></section>' : '') +
        '<section style="' + (motionMode === 'hidden' ? 'opacity:0' : '') + '"><div id="original" class="' + (scriptMotion || transitionMotion ? 'box' : 'moving') + '"></div></section>' +
        (motionMode === 'mixed' ? '<div id="other" class="moving"></div>' : '') +
        (motionMode === 'padding' ? '<div id="new-one" class="moving honors"></div><div id="new-two" class="moving honors"></div><div id="new-three" class="moving honors"></div>' : '') +
        (scriptMotion ? '<script>' + (motionMode === 'script-honored' ? 'if(!matchMedia("(prefers-reduced-motion:reduce)").matches)' : '') +
          'document.getElementById("original").animate([{transform:"translateX(0)"},{transform:"translateX(20px)"}],{duration:1000,iterations:Infinity});</script>' : '') +
        (transitionMotion ? '<script>setTimeout(()=>document.getElementById("original").style.transform="translateX(20px)",100);</script>' : '') +
        '</main></body></html>')
    } else if (req.url === '/loading-observation') {
      res.setHeader('content-type', 'text/html')
      if (loadingUiMode === 'challenge' || loadingUiMode === 'desktop-challenge' && !/Mobile|Android|iPhone/i.test(String(req.headers['user-agent']))) {
        res.setHeader('cf-mitigated', 'challenge'); res.end('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'); return
      }
      if (loadingUiMode === 'blank') { res.end('<html><head><title>Loading observation fixture</title></head><body><main></main></body></html>'); return }
      const clearMs = loadingUiDesktopMs !== undefined && !/Mobile|Android|iPhone/i.test(String(req.headers['user-agent'])) ? loadingUiDesktopMs : loadingUiClearMs
      res.end('<!doctype html><html lang="en"><head><title></title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
        '<main><h1>Useful website information</h1><div id="blocking" class="hero-skeleton" style="width:100%;height:180px">Loading content</div>' +
        '<div class="skeleton" style="position:absolute;top:1800px;width:200px;height:100px"></div>' +
        '<div style="opacity:0"><div class="spinner" style="width:200px;height:100px"></div></div></main>' +
        '<footer><div class="spinner" style="width:12px;height:12px"></div></footer><script>' +
        'setTimeout(()=>document.title="Loading observation fixture",6000);' +
        (clearMs === null ? '' : 'setTimeout(()=>document.getElementById("blocking").remove(),' + clearMs + ');') +
        '</script></body></html>')
    } else if (req.url === '/slow-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html><head><title>Slow visibility entry</title></head><body><script>location.replace("/slow-visibility")</script></body></html>')
    } else if (req.url === '/slow-visibility') {
      res.setHeader('content-type', 'text/html')
      if (slowReplayMode === 'challenge') {
        res.setHeader('cf-mitigated', 'challenge'); res.end('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'); return
      }
      const delayed = slowReplayMode === 'delayed' || slowReplayMode === 'competing'
      res.end('<!doctype html><html lang="en"><head><title>Slow visibility fixture</title></head><body><main>' +
        '<p id="message" style="display:' + (slowReplayMode === 'delayed' ? 'none' : 'block') + '">Useful information that explains the product to a visitor.</p>' +
        '<a id="' + (delayed ? 'action' : 'renamed') + '" href="/start" style="display:' + (delayed ? 'none' : 'block') + '">Get started</a></main>' +
        (slowReplayMode === 'competing' ? '<a id="competing" href="/contact">Contact</a>' : '') +
        (delayed ? '<script>setTimeout(()=>document.getElementById("message").style.display="block",6000);setTimeout(()=>document.getElementById("action").style.display="block",8500)</script>' : '') + '</body></html>')
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
    } else if (req.url === '/transport') {
      if (transportMode === 'https' && req.headers['x-fixture-protocol'] === 'http:') {
        res.writeHead(301, { location: origin + '/transport' }); res.end(); return
      }
      res.setHeader('content-type', 'text/html')
      if (transportMode === 'unavailable') res.statusCode = 503
      res.end('<!doctype html><html lang="en"><head><title>Useful transport observation fixture</title></head><body><main>' +
        '<h1>Useful service for teams</h1><p>Contact support@example.com.</p><a href="/privacy">Privacy policy</a></main></body></html>')
    } else if (req.url === '/security-coverage') {
      res.setHeader('content-type', 'text/html')
      for (const [key, value] of Object.entries(healthyHeaders)) res.setHeader(key, value)
      res.end('<!doctype html><html lang="en"><head><title>Useful security observation fixture</title></head><body><main>' +
        '<h1>Useful service for teams</h1><p>Contact our team at support@example.com.</p>' +
        '<a href="/privacy">Privacy policy</a><img src="/hero.png" alt="Service illustration"></main></body></html>')
    } else if (req.url === '/headers' || req.url === '/headers-other') {
      if (headerMode === 'redirected' && req.url === '/headers') {
        res.writeHead(302, { location: origin + '/headers-other' }); res.end(); return
      }
      res.setHeader('content-type', 'text/html')
      if (headerMode !== 'failed' && headerMode !== 'forbidden') for (const [key, value] of Object.entries(healthyHeaders)) res.setHeader(key, value)
      if (headerPolicyOverrides) for (const [key, value] of Object.entries(headerPolicyOverrides)) res.setHeader(key, value)
      if (headerMode === 'forbidden') res.statusCode = 403
      if (headerMode === 'rate-limited') res.statusCode = 429
      if (headerMode === 'partial') res.setHeader('strict-transport-security', 'max-age=60; includeSubDomains; preload')
      if (headerMode === 'challenge') res.setHeader('cf-mitigated', 'challenge')
      res.end('<!doctype html><html><head>' + (headerTitleMissing ? '' : '<title>Header fixture</title>') + '</head><body><h1>Header fixture</h1></body></html>')
    } else if (req.url === '/parser-isolation') {
      res.setHeader('content-type', 'text/html')
      if (parserFixtureHeaders) for (const [key, value] of Object.entries(healthyHeaders)) res.setHeader(key, value)
      res.end('<!doctype html><html lang="en"><head><title>Independent observation fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
        '<body><main><h1>Useful reports for your team</h1><p>Review clear evidence for your project.</p><button id="original" type="button">' +
        (parserFixtureRepaired ? 'Continue' : '') + '</button></main><script>console.error("ReferenceError: independent fixture script failure")</script></body></html>')
    } else if (req.url === '/metadata-presence') {
      if (metadataPresenceMode === 'unavailable') { res.writeHead(503); res.end('Temporarily unavailable'); return }
      const healthy = metadataPresenceMode === 'healthy' || metadataPresenceMode === 'healthy-large' || metadataPresenceMode === 'oversized'
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html' + (healthy ? ' lang="en"' : '') + '><head><title>Useful reports for your team</title>' +
        '<meta name="description" content="Prepare useful project reports with a clear record of the results.">' +
        (healthy ? '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">' +
          '<meta property="og:title" content="' + (metadataPresenceMode === 'oversized' ? 'x'.repeat(9000) : 'Useful reports') + '"><meta property="og:description" content="Prepare useful project reports"><meta property="og:image" content="https://example.com/preview.png">' : '') +
        '</head><body><main><h1>Prepare useful reports for your team</h1><p>Review the evidence and share a clear record of your project results.</p>' +
        (metadataPresenceMode === 'incomplete' || metadataPresenceMode === 'healthy-large' ? '<div hidden>' + 'Unbounded document evidence. '.repeat(50_000) + '</div>' : '') + '</main></body></html>')
    } else if (req.url === '/literal-identifiers') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Project planning for teams</title>' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Keep project records together and plan useful work with your team."></head>' +
        '<body><main><h1>Plan projects with your team</h1><p>Keep project information together and share a clear record of what needs attention.</p>' +
        '<span id=":r0:">Open details</span><button type="button" aria-labelledby=":r0:"></button>' +
        '<span id="plan.label">Contact support</span><a href="mailto:help@example.com" aria-labelledby="plan.label"></a>' +
        '<label for="quoted&quot;field">Project name</label><input id="quoted&quot;field">' +
        (literalIdsRepaired ? '<a href="/privacy">Privacy policy</a>' : '') + '</main></body></html>')
    } else if (req.url === '/field-inventory') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Project signup</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body><main><h1>Plan projects for your team</h1><p>Keep project information together and start working with your team.</p>' +
        '<form id="signup"></form>' + Array.from({ length: formInventoryCount }, (_, index) => '<label>Project detail ' + index +
          '<input form="signup" name="detail' + index + '" required></label>').join('') +
        '<input type="submit" value="Sign up" form="signup"></main></body></html>')
    } else if (req.url === '/public-form-submission') {
      publicFormSubmissions++
      res.end('This endpoint must not receive a public validation probe.')
    } else if (req.url === '/public-form') {
      const mode = publicFormMode
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Public form fixture</title></head><body><main><h1>Public form fixture</h1>' +
        (mode === 'unrelated' || mode === 'hidden' ? '<form id="other"><label>Other email<input name="other" required></label><button>Other form</button></form>' : '') +
        '<form id="primary"' + (mode === 'hidden' ? ' hidden' : '') + '>' + (publicFormExternal ? '</form>' : '') + '<label>Email<input name="email" aria-required="true"' +
        (publicFormExternal ? ' form="primary" aria-errormessage="error"' : '') +
        (mode === 'native' ? ' required' : '') + (mode === 'prefilled' ? ' value="PRIVATE_FORM_VALUE@example.test"' : '') +
        '></label><button type="submit"' + (publicFormExternal ? ' form="primary"' : '') + '>Subscribe</button><p role="alert" id="error" hidden></p>' + (publicFormExternal ? '' : '</form>') +
        '<script>const form=document.getElementById("primary"),mode=' + JSON.stringify(mode) + ';window.validationCalls=0;' +
        'form.onsubmit=e=>{if(e.defaultPrevented)return;window.validationCalls++;e.preventDefault();' +
        'if(mode==="blocked")fetch("/public-form-submission",{method:"POST",body:"unauthorized"}).catch(()=>{});' +
        'if(mode==="socket")new WebSocket("wss://example.com/public-form-submission");' +
        'if(mode==="peer")new RTCPeerConnection();if(mode==="popup")window.open("/public-form-submission");' +
        'if(mode==="outside")setTimeout(()=>{const p=document.createElement("p");p.setAttribute("role","alert");p.textContent="Error outside the form";document.body.append(p)},100);' +
        'if(mode==="slow"||mode==="healthy")setTimeout(()=>{const p=document.getElementById("error");p.hidden=false;p.textContent="Email is required"},mode==="slow"?1400:100)};</script>' +
        '</main></body></html>')
    } else if (req.url?.startsWith('/pagespeed-fixture')) {
      if (pageSpeedMode === 'refused') { res.statusCode = 403; res.end(JSON.stringify({ error: 'Fixture provider unavailable' })); return }
      const failed = pageSpeedMode === 'failed'
      const mobile = new URL(req.url!, 'http://fixture.test').searchParams.get('strategy') === 'mobile'
      const failedResources = failed || mobile && mobileResourceMode === 'failed'
      const missingResources = pageSpeedMode === 'missing' || mobile && mobileResourceMode === 'missing'
      const requestedResourcePage = new URL(req.url!, 'http://fixture.test').searchParams.get('url')
      const differentResources = pageSpeedMode === 'different-resources' || mobile && mobileResourceMode === 'different' ||
        resourcePeerCriteria && requestedResourcePage === origin + '/performance-peer'
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ lighthouseResult: {
        ...(performanceScopeMode === 'missing' ? {} : { requestedUrl: requestedResourcePage,
          finalUrl: performanceScopeMode === 'redirect' ? origin + '/changed-provider-destination' : requestedResourcePage,
          lighthouseVersion: performanceScopeMode === 'engine' ? '14.0.0' : '13.0.0',
          configSettings: { formFactor: mobile ? 'mobile' : 'desktop', throttlingMethod: 'simulate',
            throttling: { cpuSlowdownMultiplier: performanceScopeMode === 'profile' ? 1 : 4 } } }),
        categories: { performance: { score: failed ? 0.35 : 0.95 } }, audits: {
        ...(pageSpeedMode === 'missing-vitals' ? {
          'cumulative-layout-shift': { numericValue: 0, errorMessage: 'Controlled layout measurement failure' },
        } : {
          'largest-contentful-paint': { numericValue: pageSpeedMode === 'failed-vitals' ? 5000 : 1000 },
          'cumulative-layout-shift': { numericValue: pageSpeedMode === 'failed-vitals' ? 0.3 : 0 },
        }),
        'first-contentful-paint': { numericValue: 500 }, 'total-blocking-time': { numericValue: 0 },
        ...(mobile && mobileTapMode !== 'missing' ? {
          [mobileTapMode === 'different' ? 'tap-targets' : 'target-size']: {
            score: mobileTapMode === 'failed' ? 0 : 1, title: 'Touch target size and spacing',
            details: { items: mobileTapMode === 'failed' ? [{}] : [] },
          },
        } : {}),
        ...(missingResources ? {} : {
          [differentResources ? 'render-blocking-resources' : 'render-blocking-insight']: { score: failedResources ? 0 : 1, metricSavings: { FCP: failedResources ? 900 : 0 } },
          'unused-javascript': { score: failedResources ? 0 : 1, details: { overallSavingsBytes: failedResources ? 200_000 : 0 } },
          'unused-css-rules': { score: failedResources ? 0 : 1, details: { overallSavingsBytes: failedResources ? 80_000 : 0 } },
          ...(resourceImageMode ? Object.fromEntries(['uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'efficient-animated-content']
            .flatMap((id, index) => {
              if (resourceImageMode?.startsWith('partial') && index > 0 || resourceImageMode === 'different-failure' && index !== 0 && index !== 2) return []
              const failing = resourceImageMode === 'original' && index < 2 || resourceImageMode === 'partial-failed' && index === 0 || resourceImageMode === 'different-failure' && index === 2
              return [[id, { score: failing ? 0 : 1, details: { overallSavingsBytes: failing ? 100_000 : 0 } }]]
            })) : differentResources ? Object.fromEntries(['uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'efficient-animated-content']
            .map((id, index) => [id, { score: failedResources && index === 0 ? 0 : 1,
              details: { overallSavingsBytes: failedResources && index === 0 ? 150_000 : 0 } }])) : {
            'image-delivery-insight': { score: failedResources ? 0 : 1, details: { debugData: { wastedBytes: failedResources ? 150_000 : 0 } } },
          }),
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
      const repaired = req.url.includes('independent=1') ? independentActions === 'healthy' : trackingRepaired
      res.setHeader('content-type', 'application/javascript')
      res.writeHead(repaired ? 200 : 503)
      res.end(repaired ? 'navigator.sendBeacon("/_vercel/insights/view", "PRIVATE_TRACKING_PAYLOAD")' : 'Library unavailable')
    } else if (req.url === '/purchase-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Purchase fixture</title></head><body>' +
        '<h1>Canvas Tote</h1><p>$48</p><button id="add" type="button">Add to cart</button>' +
        '<div id="CartDrawer" hidden><p>Item added</p><p>Your cart (1)</p></div><footer>Pay securely with Shop Pay</footer>' +
        (checkoutJourneyHealthy ? '<script>document.querySelector("#add").onclick=()=>{const frame=document.createElement("iframe");frame.src="/checkout";frame.style="width:350px;height:600px";document.body.append(frame)}</script>' : '') +
        '</body></html>')
    } else if (req.url === '/checkout') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Checkout</title></head><body><h1>Checkout</h1><label>Email <input type="email" autocomplete="email"></label></body></html>')
    } else if (['/nested/checkout-destination', '/nested/login-destination', '/nested/preview.png', '/nested/canonical-target'].includes(req.url ?? '')) {
      res.setHeader('content-type', req.url?.endsWith('/preview.png') ? 'image/png' : 'text/html')
      res.writeHead(req.method === 'HEAD' || destinationsRepaired ? 200 : 404)
      res.end(destinationsRepaired && req.url?.endsWith('/preview.png')
        ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTwsAAAAASUVORK5CYII=', 'base64')
        : destinationsRepaired ? 'Available destination' : 'Missing destination')
    } else if (req.url?.startsWith('/other/') || ['/checkout-destination', '/login-destination', '/preview.png'].includes(req.url ?? '')) {
      res.setHeader('content-type', req.url?.endsWith('/preview.png') ? 'image/png' : 'text/html')
      res.end('A competing healthy destination')
    } else if (req.url === '/independent-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Useful service for teams</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<script src="/_vercel/insights/script.js?independent=1"></script></head><body><header' + (independentActions === 'missing' ? ' hidden' : '') + '><a id="prices" href="/independent-pricing">Pricing</a></header>' +
        '<main><h1>Useful service for your team</h1><p>Plan useful work and choose the right next step.</p>' +
        '<form id="independent-form"><label>Email<input type="email" name="email" style="font-size:' + (independentActions === 'healthy' ? 16 : 12) + 'px"></label></form>' +
        '<button id="independent-control"' + (independentActions === 'healthy' ? ' aria-label="Open details"' : '') + '><svg aria-hidden="true" width="20" height="20"><rect width="20" height="20"/></svg></button>' +
        (independentActions === 'missing' ? '' : '<a id="primary" href="/independent-action">Get started free</a>') +
        '<div hidden>' + (independentInventoryBound ? '<a href="/details">Details</a>'.repeat(10_001) : 'Large retained DOM content. '.repeat(45_000)) + '</div></main></body></html>')
    } else if (req.url === '/independent-action' || req.url === '/independent-pricing') {
      res.setHeader('content-type', 'text/html')
      res.writeHead(independentActions === 'healthy' ? 200 : 404)
      res.end(independentActions === 'healthy' ? '<!doctype html><main><h1>' + (req.url.endsWith('pricing') ? 'Pricing plans for teams' : 'Get started with your team') + '</h1><p>Review the available information.</p></main>' : 'Missing destination')
    } else if (req.url === '/destinations') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Destination fixture</title><template><base href="' + destinationOrigin + '/template/"></template>' +
        '<noscript><base href="' + destinationOrigin + '/fallback/"></noscript><base href="' + destinationOrigin + destinationBasePath + '"><meta property="og:image" content="preview.png"><link rel="canonical" href="canonical-target"></head>' +
        '<body><noscript><form><input name="email"><button>Sign up</button></form>' +
        Array.from({ length: 10 }, (_, index) => '<a href="login-inactive-' + index + '">Sign in</a>').join('') + '</noscript>' +
        '<template><form><input name="company"><button>Get started free</button></form></template>' +
        '<main><h1>Destination fixture</h1><a href="checkout-destination">Subscribe</a><a href="login-destination">Log in</a>' +
        (destinationLarge ? '<div hidden>' + 'Large retained DOM content. '.repeat(50_000) + '</div>' : '') + '</main></body></html>')
    } else if (req.url === '/structured-isolation') {
      res.setHeader('content-type', 'text/html')
      const product = { '@context': 'https://schema.org', '@type': 'Product', '@id': structuredPhase === 'changed' ? '#other' : '#product',
        name: 'Useful service', offers: { '@type': 'Offer', price: structuredPhase === 'failed' ? 'free' : '12' } }
      res.end('<!doctype html><html lang="en"><head><title>Structured information</title>' +
        '<script type="application/ld+json">' + JSON.stringify(product) + '</script><script type="application/ld+json">{"@type":</script>' +
        '</head><body><main><h1>Useful service ' + 'Detailed product information. '.repeat(400) + '</h1></main></body></html>')
    } else if (req.url === '/tracking') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Tracking fixture</title>' + (trackingEnabled ? '<script src="/_vercel/insights/script.js?project=' + trackingProject + '"></script>' : '') + '</head>' +
        '<body><main><h1>Tracking fixture</h1><a href="#details"' + (trackingEnabled ? ' onclick="const s=document.createElement(\'script\');s.src=\'/_vercel/insights/script.js?phase=action&project=' + trackingActionProject + '\';document.head.append(s)"' : '') + '>Get started</a><section id="details">Useful details</section></main></body></html>')
    } else if (req.url === '/action-hierarchy') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Useful service for teams</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        'body{background:white}a{display:block;width:max-content;margin:12px 0;padding:12px 20px;font:600 16px Arial;background:#174ba5;color:white;border:1px solid #174ba5}' +
        (actionHierarchy === 'secondary' ? '.secondary{background:transparent;color:#174ba5;border-color:transparent}' : '') +
        (actionHierarchy === 'complex' ? 'a{background-image:linear-gradient(#174ba5,black)}' : '') +
        '</style></head><body><main><h1>Useful service for teams</h1><p>Choose your next step.</p>' +
        '<a href="#signup">Get started</a><a class="secondary" href="#demo">Request demo</a><a class="secondary" href="#pricing">Pricing</a>' +
        '<section id="signup">Start using this service.</section><section id="demo">Review the product demonstration.</section><section id="pricing">Review pricing details.</section>' +
        '<div hidden>' + (actionHierarchyBound === 'bytes' ? 'Large retained DOM content. '.repeat(45_000) : actionHierarchyBound === 'records' ? '<img alt="">'.repeat(10_001) : '') + '</div></main></body></html>')
    } else if (req.url === '/input-sizing') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Useful signup information</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>input{font-size:16px}#original input{font-size:' + (inputSizing === 'expanded' ? 16 : 12) + 'px}</style></head><body><main>' +
        '<h1>Useful information for your team</h1><p>Choose the information you want to receive about this service.</p>' +
        (inputSizing === 'removed' ? '' : '<form id="original"><label>Signup email<input type="' + (inputSizing === 'changed' ? 'text' : 'email') + '" name="email"></label></form>') +
        '<form id="footer"><label>Newsletter email<input type="email" name="email"></label></form>' +
        (inputSizing === 'expanded' ? '<form id="additional"><label>Another field<input type="text" name="another"></label></form>' : '') + '</main></body></html>')
    } else if (req.url === '/keyboard-components') {
      res.setHeader('content-type', 'text/html')
      const contents = (fixed: boolean) => '<style>button:focus-visible{outline:' + (fixed ? '3px solid blue' : 'none') + ';box-shadow:none}</style><button id="action">Action</button>' +
        '<input type="radio" name="choice" aria-label="First choice" checked><input type="radio" name="choice" aria-label="Second choice">'
      res.end('<!doctype html><html lang="en"><head><title>Component keyboard fixture</title></head><body><main><h1>Component controls</h1>' +
        '<a href="#details">Learn more</a><section id="details">Public component controls</section><x-controls id="first"></x-controls><x-controls id="second"></x-controls></main><script>' +
        'document.getElementById("first").attachShadow({mode:"open"}).innerHTML=' + JSON.stringify(contents(componentKeyboard !== 'failed')) + ';' +
        'document.getElementById("second").attachShadow({mode:' + JSON.stringify(componentKeyboard === 'closed' ? 'closed' : 'open') + '}).innerHTML=' +
        JSON.stringify(contents(componentKeyboard === 'healthy')) + '</script></body></html>')
    } else if (req.url === '/keyboard-entry') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html><head><title>Keyboard entry</title></head><body><script>location.replace("/keyboard")</script></body></html>')
    } else if (req.url === '/keyboard') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Keyboard fixture</title><style>#first:focus-visible,#second:focus-visible {' +
        (focusRepaired ? 'outline:3px solid blue;outline-offset:2px' : 'outline:3px solid white;outline-offset:2px;box-shadow:none') +
        '}#second:focus-visible span{color:blue}#second:focus-visible::after{background:blue}</style></head><body><main><h1>Keyboard fixture</h1><button id="first">First</button><button id="second" aria-label="Second">Second<span hidden>Hidden detail</span></button>' +
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

  const realCreateAuditPage = pageSessions.createAuditPage
  function fixtureTransport() {
    return vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => realCreateAuditPage(browser, url, {
      ...options, configurePage: async page => {
        // Serve controlled HTML through real Chromium. Retain the production
        // mutation guard rather than granting the fixture implicit submission consent.
        await page.route(/^https?:\/\/example\.com\//, async route => {
          if (postClickEarly && new URL(route.request().url()).pathname === '/post-click-script.js') { postClickPendingRoutes.add(route); return }
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
        return nativeFetch(`http://127.0.0.1:${address.port}/pagespeed-fixture?strategy=${url.searchParams.get('strategy')}&url=${encodeURIComponent(url.searchParams.get('url') ?? '')}`, init)
      if (![origin, destinationOrigin, 'http://example.com'].includes(url.origin)) throw new Error('External service unavailable in this fixture')
      const headers = new Headers(init?.headers)
      headers.set('x-fixture-protocol', url.protocol)
      return nativeFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, { ...init, headers })
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Execution fixture', url: origin + '/', canonicalHost: 'example.com' } })
    await getAuditTaskQueue('browser').pause()
    await pauseExternalQueues()
    await getAuditBrowser()
    worker = startWorker()
    await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
  })

  afterAll(async () => {
    releaseResources()
    await worker?.close()
    await clearWorkerHeartbeat()
    await closeBrowser()
    // A focused test may never reach the scenario that resumes these queues.
    // Release the fixture's broker pause before closing the shared Redis client.
    await getAuditTaskQueue('browser').resume()
    await resumeExternalQueues()
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
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
    await resumeExternalQueues()
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

  it('publishes independent category evidence during a real browser outage and retains honest incomplete coverage', async () => {
    releaseResources()
    headerMode = 'partial'
    const transport = fixtureTransport()
    let restoreBrowser = () => {}
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/headers', idempotencyKey: 'browser-outage-inventory' })
      await vi.waitFor(async () => {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: source.auditId!,
          workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] },
          workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(source.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: source.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 250 })
      await closeBrowser()
      const rendering = await import('@/lib/audit/screenshot')
      const unavailable = vi.spyOn(rendering, 'getAuditBrowser').mockRejectedValue(new Error('Controlled browser startup failure'))
      restoreBrowser = () => { unavailable.mockRestore() }
      expect(getBrowserDiagnostics().connected).toBe(false)
      await touchWorkerHeartbeat({ browserOk: false, activeBrowserContexts: 0, queueState: 'idle' })
      expect(await readWorkerHeartbeat()).toMatchObject({ alive: true, browserOk: false })
      const category = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY',
        categoryArea: 'security', idempotencyKey: 'independent-security-outage' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: category.auditId!, targetKey: 'module:security-headers' } }))
          .toMatchObject({ status: 'COMPLETED' })
        expect(await prisma.flag.findFirst({ where: { auditId: category.auditId!, checkId: 'security-hsts-too-short' } })).toMatchObject({ severity: 'IMPORTANT' })
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: category.auditId!, workKind: 'browser' } }))
          .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'BROWSER_UNHEALTHY' })
      }, { timeout: 15_000, interval: 100 })
      expect(getBrowserDiagnostics().connected).toBe(false)
      // Bound the controlled outage rather than waiting out production recovery.
      // Browser observations remain unavailable, with no positive stand-in data.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: category.auditId!, workKind: 'browser' },
        data: { workRecoveryUntil: new Date(0) } })
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(category.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: category.auditId! } })).toMatchObject({
          improvementProjectedAt: expect.any(Date), reportCompleteness: 'PARTIAL' })
      }, { timeout: 20_000, interval: 250 })
      expect(await getOwnedRun(userId, category.runId)).toMatchObject({ scope: 'CATEGORY', result: 'FLAG', completionState: 'PARTIAL' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: category.auditId!, workKind: 'browser' } }))
        .toMatchObject({ workState: 'EXHAUSTED' })
    } finally {
      headerMode = 'failed'
      restoreBrowser(); await getAuditBrowser()
      await touchWorkerHeartbeat({ browserOk: getBrowserDiagnostics().connected, queueState: 'idle' })
      transport.mockRestore()
    }
  }, 90_000)

  it('retries an interrupted category through shared owner admission and workers without broadening its scope', async () => {
    releaseResources()
    const transport = fixtureTransport(), evaluateQueue = getAuditTaskQueue('evaluate')
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/headers', idempotencyKey: 'retry-inventory' })
      expect(await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/headers', idempotencyKey: 'retry-inventory' })).toMatchObject({ auditId: source.auditId, runId: source.runId, reused: true })
      await vi.waitFor(async () => {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: source.auditId!,
          workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] },
          workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(source.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: source.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 250 })
      await evaluateQueue.pause()
      const interrupted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY',
        categoryArea: 'security', idempotencyKey: 'interrupted-category' })
      const original = await prisma.audit.findUniqueOrThrow({ where: { id: interrupted.auditId! } })
      // Inject termination before evaluation can finish. Existing observations
      // remain real; no passing website or repair evidence is manufactured.
      await prisma.$transaction([
        prisma.audit.update({ where: { id: original.id }, data: { status: 'FAILED', completedAt: new Date(), errorMsg: 'Controlled worker interruption' } }),
        prisma.runRequest.update({ where: { id: interrupted.runId }, data: { status: 'FAILED', leaseUntil: null } }),
      ])
      await evaluateQueue.resume()
      const retry = await retryAudit(original.id, { userId, visitorKey: '', anonymousAuditIds: [] })
      if (!('runId' in retry)) throw new Error('Owned retry lost its Site run identity')
      expect(retry.auditId).not.toBe(original.id)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(retry.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: retry.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 25_000, interval: 250 })
      const after = await prisma.audit.findUniqueOrThrow({ where: { id: retry.auditId! } })
      const beforeSpec = readExecutionSpec(original.executionSpec)!, afterSpec = readExecutionSpec(after.executionSpec)!
      expect(afterSpec).toMatchObject({ scope: 'CATEGORY', category: beforeSpec.category, checks: beforeSpec.checks, targetUrl: beforeSpec.targetUrl })
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: retry.runId! } })).toMatchObject({
        context: { previousAuditId: original.id, previousRunId: interrupted.runId }, status: 'COMPLETED' })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: after.id, workKind: { not: null } } })
      expect(tasks.some(task => ['captures', 'judge', 'discovery', 'pagespeed', 'slow-replay', 'journeys'].includes(task.workKind!))).toBe(false)
      expect(await retryAudit(original.id, { userId, visitorKey: '', anonymousAuditIds: [] })).toMatchObject({
        auditId: after.id, status: 'COMPLETED', reused: true })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'FAILED', errorMsg: 'Controlled worker interruption' })
    } finally { await evaluateQueue.resume(); transport.mockRestore() }
  }, 100_000)

  it('rechecks categories on the real ledger without replacing full-site analysis or resolving unrelated Flags', async () => {
    releaseResources()
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
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
        const categoryFindings = await prisma.flag.findMany({ where: { auditId: audit.id } })
        for (const finding of categoryFindings) {
          const supporting = finding.supportingObservations as { version: number; items: Array<{ checkVersion: number; provenance: { auditId: string; taskId: string } }> }
          expect(supporting).toMatchObject({ version: 1, items: expect.any(Array) })
          expect(supporting.items.length).toBeGreaterThan(0)
          for (const item of supporting.items) {
            expect(item.checkVersion).toBeGreaterThan(0)
            expect(item.provenance.auditId).toBe(audit.id)
            expect(tasks.some(task => task.id === item.provenance.taskId)).toBe(true)
          }
        }
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
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
      await pauseExternalQueues()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/keyboard-entry', idempotencyKey: 'keyboard-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'keyboard' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['browser', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume()
      await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'focus-visible-missing' } })
      expect(flag).toMatchObject({ source: 'DETERMINISTIC', pageUrl: origin + '/keyboard-entry',
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
      expect(popupFlag.evidenceTargets).toMatchObject([{ selector: '#options', context: expect.stringContaining(':menu:#options=>#menu') }])
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
        assertion: { targets: [{ selector: '#options', label: 'Options', context: expect.stringContaining(':menu:#options=>#menu') }] } })
      expect(await prisma.improvementAttempt.findUnique({ where: { id: popupFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    } finally { transport.mockRestore() }
  })
  it('verifies exact component controls through partial repair, closed-root uncertainty and monitoring recurrence', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/keyboard-components'
    const componentUser = userId + '-components', componentSite = projectId + '-components'
    await prisma.user.create({ data: { id: componentUser, email: componentUser + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: componentSite, userId: componentUser, name: 'Component fixture', canonicalHost: 'example.com', url: pageUrl } })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      componentKeyboard = 'failed'
      const source = await requestSiteRun({ projectId: componentSite, userId: componentUser, outcomeIds: [], source: 'WEB',
        scope: 'SITE', idempotencyKey: 'component-keyboard-source' })
      const completed = async (auditId: string, isolateKeyboard = false) => {
        try {
          await vi.waitFor(async () => {
            if (isolateKeyboard) {
              // Unrelated provider and capture evidence is unavailable here.
              // The keyboard collector and its downstream projection remain real.
              await prisma.auditVerifierExecution.updateMany({ where: { auditId,
                workKind: { in: ['browser', 'captures', 'pagespeed', 'google'] }, workState: { not: 'COMPLETED' } },
                data: { workRecoveryUntil: new Date(0) } })
              await dispatchReadyTasks(await reconcileTasks(auditId))
            }
            expect(await prisma.audit.findUnique({ where: { id: auditId } }))
              .toMatchObject({ improvementProjectedAt: expect.any(Date) })
          }, { timeout: 60_000, interval: 100 })
        } catch (error) {
          const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId, targetKey: { startsWith: 'task:' },
            workState: { not: 'COMPLETED' } }, select: { targetKey: true, workState: true, workErrorCode: true } })
          throw new Error('Component fixture did not settle: ' + JSON.stringify(tasks), { cause: error })
        }
      }
      await completed(source.auditId!, true)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'focus-visible-missing' } })
      expect(flag.evidenceTargets).toMatchObject([{ selector: '#first >>> #action' }, { selector: '#second >>> #action' }])
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      for (const phase of ['partial', 'closed', 'healthy'] as const) {
        componentKeyboard = phase
        const fixed = await recordSiteFlagFix({ siteId: componentSite, userId: componentUser, flagId: flag.id,
          idempotencyKey: 'component-keyboard-fix:' + phase, changeSummary: 'Restore the original component focus indicators' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: componentSite, userId: componentUser, flagId: flag.id,
          attemptId: fixed.attemptId, idempotencyKey: 'component-keyboard-verify:' + phase })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Component keyboard verification was not admitted')
        await completed(verification.verificationAuditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({
          outcome: phase === 'partial' ? 'UNCHANGED' : phase === 'closed' ? 'INCONCLUSIVE' : 'IMPROVED', comparable: phase !== 'closed' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'healthy' ? 'FIXED' : 'OPEN' })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verification.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'keyboard'])
        const keyboard = keyboardEvidenceSchema.parse(readArtifact(tasks.find(task => task.workKind === 'keyboard')!.workResult, 'keyboard').data)
        expect(keyboard.navigationComplete).toBe(phase !== 'closed')
        if (phase !== 'closed') expect(keyboard.candidateCount).toBe(5)
      }
      componentKeyboard = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const recurrence = await requestScheduledSiteRun({ projectId: componentSite, userId: componentUser, interval: 'weekly', scheduledAt: tick, now: tick })
      await completed(recurrence.auditId!, true)
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: flag.checkId } })
      expect(recurred).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurred.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally { componentKeyboard = 'failed'; transport.mockRestore() }
  }, 180_000)

  it('releases stalled private storage, retains independent observations and finalizes honest partial coverage', async () => {
    const transport = fixtureTransport(), storageConnections = new Set<import('node:net').Socket>()
    let storageRequests = 0
    const storageServer = createServer(request => { storageRequests++; request.resume() })
    storageServer.on('connection', socket => { storageConnections.add(socket); socket.once('close', () => storageConnections.delete(socket)) })
    await new Promise<void>(resolve => storageServer.listen(0, '127.0.0.1', resolve))
    const storageOrigin = 'http://127.0.0.1:' + (storageServer.address() as { port: number }).port
    for (const [key, value] of Object.entries({ R2_ACCOUNT_ID: 'fixture', R2_ACCESS_KEY_ID: 'fixture-key', R2_SECRET_ACCESS_KEY: 'fixture-secret',
      R2_BUCKET_NAME: 'fixture-bucket', R2_PUBLIC_URL: storageOrigin, R2_S3_ENDPOINT: storageOrigin, R2_FORCE_PATH_STYLE: 'true' })) vi.stubEnv(key, value)
    // Exercise the production S3 adapter without switching unrelated worker
    // behavior to production mode. Native capture and deadline propagation stay real.
    const storage = vi.spyOn(screenshotStorage, 'uploadScreenshot').mockImplementation(async (auditId, device, buffer, key, options) => {
      try { return await uploadToS3(auditId, device, buffer, key, options) }
      catch (error) { throw new StorageUploadError('Controlled private storage interruption', { cause: error }) }
    })
    try {
      releaseResources(); await getAuditTaskQueue('browser').pause()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/performance-fixture', idempotencyKey: 'storage-outage-source' })
      const auditId = admitted.auditId!
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'captures' } }))
        .not.toBeNull(), { timeout: 10_000, interval: 100 })
      // Keep this storage fault focused. Unrelated provider and interaction
      // work is unavailable, rather than substituted with successful evidence.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId, workKind: { notIn: ['http', 'browser', 'captures', 'check', 'finalize'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      await getAuditTaskQueue('browser').resume()
      await vi.waitFor(async () => {
        expect(storageRequests).toBeGreaterThan(0)
        expect(await prisma.flag.findFirst({ where: { auditId, checkId: 'security-headers-missing' } })).not.toBeNull()
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'browser' } })).toMatchObject({ workState: 'COMPLETED' })
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'captures' } })).toMatchObject({ workState: 'RUNNING' })
      }, { timeout: 15_000, interval: 100 })
      await vi.waitFor(async () => {
        const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, workKind: 'captures' } })
        expect(task).toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'STORAGE_UPLOAD_INTERRUPTED', workAttempts: 1 })
        expect(task.workLeaseUntil?.getTime() ?? 0).toBeLessThan(Date.now())
      }, { timeout: 20_000, interval: 100 })
      await vi.waitFor(() => expect(storageConnections.size).toBe(0))
      await prisma.auditVerifierExecution.updateMany({ where: { auditId, workKind: 'captures' }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
        .toMatchObject({ status: 'COMPLETED', reportCompleteness: 'PARTIAL', improvementProjectedAt: expect.any(Date) }), { timeout: 30_000, interval: 100 })
      expect(await prisma.screenshot.count({ where: { auditId } })).toBe(0)
      expect(await prisma.flag.findFirst({ where: { auditId, checkId: 'security-headers-missing' } })).not.toBeNull()
    } finally {
      storage.mockRestore(); transport.mockRestore(); vi.unstubAllEnvs()
      storageServer.closeAllConnections()
      await new Promise<void>(resolve => storageServer.close(() => resolve()))
    }
  }, 90_000)

  it.each([false, true])('collects CTA style changes through the worker without certifying advisory judgments as repair (unavailable metadata: %s)', async unavailableMetadata => {
    const transport = fixtureTransport(), pageUrl = origin + '/action-hierarchy'
    const owner = userId + '-hierarchy-' + unavailableMetadata, siteId = projectId + '-hierarchy-' + unavailableMetadata
    actionHierarchyBound = unavailableMetadata ? 'bytes' : 'none'
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume()
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Action hierarchy fixture', canonicalHost: 'example.com', url: pageUrl } })
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED', isPublic: false,
        startedAt: new Date(), completedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
          targetUrl: pageUrl, environment: 'production', checks: { 'competing-ctas': 1 }, outcomes: [], verificationTarget: null } } })
      const capture = await captureScreenshots(pageUrl, source.id, undefined, { runFlow: false, captureMedia: false })
      const checked = await runAllChecks(pageUrl, capture.desktopHtml ? parseMetadataFromHtml(capture.desktopHtml, pageUrl) : null, null, null, [], undefined,
        capture.captureMetrics, undefined, undefined, true, ['cta-focus'], { renderedScope: capture.renderedScope })
      expect(checked.flags.map(flag => flag.checkId)).toEqual(['competing-ctas'])
      await persistControlledNativeSource(source.id, checked.flags.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'competing-ctas' } })
      let incompleteStyleReceipt: ReturnType<typeof checkReceiptSchema.parse> | undefined
      for (const phase of ['secondary', 'complex', 'competing'] as const) {
        actionHierarchy = phase
        actionHierarchyBound = unavailableMetadata ? 'records' : 'none'
        const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id,
          idempotencyKey: 'action-style-fix:' + phase, changeSummary: 'Adjust the primary and secondary action styles' })
        const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'action-style-verify:' + phase })
        if (!result.ok || !('verificationAuditId' in result)) throw new Error('Action style verification was not admitted')
        const auditId = result.verificationAuditId!
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 30_000, interval: 100 })
        const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, workKind: 'browser' } })
        if (unavailableMetadata) expect(readArtifact(browser.workResult, 'browser').data).toMatchObject({ metadata: null, snapshot: { desktopHtmlTruncated: false } })
        const measured = (readArtifact(browser.workResult, 'browser').data.snapshot as { captureMetrics: CaptureMetrics }).captureMetrics
        expect(measured).toMatchObject({ competingPrimaryCtaCount: phase === 'secondary' ? 1 : phase === 'complex' ? 0 : 3,
          competingPrimaryCtaComplete: phase !== 'complex' })
        const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'module:cta-focus' } })
        const styleReceipt = checkReceiptSchema.parse(receipt.detail)
        if (phase === 'complex') incompleteStyleReceipt = styleReceipt
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ reportCompleteness: phase === 'complex' ? 'PARTIAL' : 'FULL' })
        expect(styleReceipt).toMatchObject(phase === 'complex' ? { complete: false, passed: false } : { passed: phase === 'secondary' })
        expect(styleReceipt.assertions).toMatchObject([{ disposition: 'observed', complete: phase !== 'complex',
          passed: phase === 'secondary' }])
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
          .toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      }
      if (!unavailableMetadata) {
        // Reproduce a completed older evaluator checkpoint with conflicting
        // summary bits. Recovery must inspect its recorded unknown criterion.
        const evaluation = getAuditTaskQueue('evaluate')
        await evaluation.pause()
        let legacyAuditId = ''
        try {
          actionHierarchy = 'complex'
          const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id,
            idempotencyKey: 'old-style-summary-fix', changeSummary: 'Review the original action styling' })
          const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
            attemptId: fix.attemptId, idempotencyKey: 'old-style-summary-verify' })
          if (!result.ok || !('verificationAuditId' in result)) throw new Error('Old-summary recovery was not admitted')
          legacyAuditId = result.verificationAuditId!
          await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: legacyAuditId, workKind: 'browser' } }))
            .toMatchObject({ workState: 'COMPLETED' }), { timeout: 20_000, interval: 100 })
          const check = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: legacyAuditId, workKind: 'check' } })
          const raw = { ...incompleteStyleReceipt!, passed: true, complete: true,
            execution: { ...incompleteStyleReceipt!.execution!, auditId: legacyAuditId, taskId: check.id, collectedAt: new Date().toISOString() } }
          await prisma.auditVerifierExecution.create({ data: { auditId: legacyAuditId, targetKey: 'module:cta-focus', scopeKey: 'page:' + pageUrl,
            source: 'DETERMINISTIC', status: 'COMPLETED', pageUrl, checkVersion: 1, detail: raw as never } })
          await prisma.auditVerifierExecution.update({ where: { id: check.id }, data: { status: 'COMPLETED', workState: 'COMPLETED',
            workAttempts: 1, workLeaseUntil: null, workResult: serializeArtifact('check', { flags: [], receipt: raw }) as never } })
          await dispatchReadyTasks(await reconcileTasks(legacyAuditId))
        } finally { await evaluation.resume() }
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: legacyAuditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date), reportCompleteness: 'PARTIAL', failedModules: expect.arrayContaining(['cta-focus']) }),
        { timeout: 20_000, interval: 100 })
        const persisted = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: legacyAuditId, targetKey: 'module:cta-focus' } })
        expect(persisted.detail).toMatchObject({ passed: true, complete: true, assertions: [{ complete: false, disposition: 'observed' }] })
        expect(projectCheckResults(legacyAuditId, [persisted]).map(row => row.status)).toEqual(['unknown', 'unknown'])
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
    } finally { actionHierarchy = 'competing'; actionHierarchyBound = 'none'; transport.mockRestore() }
  }, 120_000)

  it('keeps the original mobile input cohort open through an unchanged sample, removed and replaced controls, and a 16px observation', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/input-sizing'
    const owner = userId + '-inputs', siteId = projectId + '-inputs'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Input sizing fixture', canonicalHost: 'example.com', url: pageUrl } })
    const completed = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        // Native page capture supplies actual font measurements. Unrelated
        // external and interaction responsibilities remain unavailable.
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      inputSizing = 'failed'
      const source = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE',
        idempotencyKey: 'input-sizing-source' })
      await completed(source.auditId!, true)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'mobile-input-zoom' } })
      expect(flag.evidenceTargets).toMatchObject([{ selector: '#original > label:nth-of-type(1) > input:nth-of-type(1)' }])
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      for (const phase of ['failed', 'removed', 'changed', 'expanded'] as const) {
        inputSizing = phase
        const fixed = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id,
          idempotencyKey: 'input-sizing-fix:' + phase, changeSummary: 'Restore mobile text sizing on the recorded signup form' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
          attemptId: fixed.attemptId, idempotencyKey: 'input-sizing-verify:' + phase })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Input sizing verification was not admitted')
        await completed(verification.verificationAuditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({
          outcome: phase === 'failed' ? 'UNCHANGED' : 'INCONCLUSIVE',
          comparable: phase === 'failed' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verification.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
      }
      inputSizing = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await completed(watch.auditId!, true)
      const recurring = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
      expect(recurring).toMatchObject({ status: 'OPEN', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } })).toMatchObject({ improvementId: original.improvementId, kind: 'OBSERVED' })
    } finally { inputSizing = 'failed'; transport.mockRestore() }
  }, 180_000)

  it('retains independent structured markup failures through bounded page context, exact property repair and Watch recurrence', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/structured-isolation'
    const owner = userId + '-structured', siteId = projectId + '-structured'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Structured evidence fixture', canonicalHost: 'example.com', url: pageUrl } })
    const completed = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      const source = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'structured-source' })
      await completed(source.auditId!, true)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'search-structured-feature' } })
      const syntax = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'search-structured-invalid' } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'browser' } })
      expect(browser.workResult).toMatchObject({ data: { snapshot: { renderedSearchSnapshot: { sections: {
        structured: { complete: true }, text: { complete: false },
      } } } } })
      for (const phase of ['failed', 'changed', 'repaired'] as const) {
        structuredPhase = phase
        const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'structured-fix:' + phase,
          changeSummary: 'Correct the original Product offer price' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'structured-verify:' + phase })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Structured markup verification was not admitted')
        await completed(verification.verificationAuditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: phase === 'failed' ? 'UNCHANGED' : phase === 'changed' ? 'INCONCLUSIVE' : 'IMPROVED', comparable: phase !== 'changed' })
        const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verification.verificationAuditId!, targetKey: 'module:search-structured-data' } })
        expect(receipt.detail).toMatchObject({ complete: false, observations: expect.arrayContaining([
          expect.objectContaining({ checkId: 'search-structured-content', disposition: 'unknown', reason: 'content_context_incomplete' }),
          expect.objectContaining({ checkId: 'search-structured-invalid', disposition: 'failed' }),
        ]) })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: syntax.id } })).toMatchObject({ status: 'OPEN' })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
      structuredPhase = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await completed(watch.auditId!, true)
      const recurring = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
      expect(recurring).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally { structuredPhase = 'failed'; transport.mockRestore() }
  }, 180_000)

  it('observes Tracking library failures in loading and the public walk, then verifies both repaired scopes without delivering events', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await pauseExternalQueues()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/tracking', idempotencyKey: 'tracking-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'browser' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      const walk = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: beforeId, targetKey: 'task:p0:flow' } })
      expect(await loadTechnologyProfile(beforeId)).toMatchObject({ status: 'complete',
        technologies: expect.arrayContaining([expect.objectContaining({ name: 'Vercel Analytics', category: 'analytics' })]) })
      expect(walk).toMatchObject({ workState: 'COMPLETED' })
      expect((readArtifact(walk.workResult, 'flow').data as { tracking: { requests: unknown[] } }).tracking.requests).toMatchObject([{ role: 'library', status: 503 }])
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'tracking-library-http-error' } })
      const targets = flag.evidenceTargets as Array<{ context: string }>
      expect(targets.some(target => target.context.startsWith('tracking:page_load:'))).toBe(true)
      expect(targets.some(target => target.context.startsWith('tracking:public_action:'))).toBe(true)
      expect(targets.every(target => /:request:v2:[a-f0-9]{64}:capture:[a-f0-9]{64}:page:/.test(target.context))).toBe(true)
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      trackingRepaired = true
      async function verify(phase: string) {
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'tracking-fix:' + phase,
          changeSummary: 'Restore the requested tracking library endpoint' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'tracking-verification:' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 100 })
        return { ...run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      trackingProject = trackingActionProject = 'PRIVATE_REPLACEMENT'
      expect((await verify('changed-project')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      trackingProject = 'PRIVATE_ORIGINAL'
      expect((await verify('changed-action-only')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      trackingActionProject = 'PRIVATE_ORIGINAL'
      const verified = await verify('repaired')
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize', 'flow'])
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:tracking-library-http-error' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'browser-network' })
      expect((proof.evidenceReference as { supportingTasks: unknown[] }).supportingTasks).toHaveLength(2)
      expect(verified.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, targetKey: 'module:measurement' } })
      const results = projectCheckResults(verified.auditId!, receipts)
      expect(results.some(result => result.assertionKey === 'tracking-initiation' && result.status === 'observed')).toBe(true)
      expect(results.filter(result => result.assertionKey === 'tracking-http-response' || result.assertionKey === 'tracking-provider-recording').every(result => result.status === 'unknown')).toBe(true)
      expect(JSON.stringify(receipts)).not.toContain('PRIVATE_TRACKING_PAYLOAD')
      expect(requests.some(path => path.startsWith('/_vercel/insights/view'))).toBe(false)
      const site = await loadSiteHome(projectId)
      expect(site!.cards.find(card => card.id === 'tracking')?.state).not.toBe('healthy')
      expect(site!.cards.find(card => card.id === 'tracking')?.sources).toContain('Vercel Analytics')
      trackingRepaired = false
      const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', url: origin + '/tracking', idempotencyKey: 'tracking-recurrence' })
      await vi.waitFor(async () => {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurring.auditId!,
          workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google'] }, workState: { not: 'COMPLETED' } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(recurring.auditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: recurring.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 100 })
      const again = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'tracking-library-http-error' } })
      expect(again).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: again.id } })).toMatchObject({ improvementId: original.improvementId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.auditId })
      trackingRepaired = true
      trackingEnabled = false
      const category = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY',
        categoryArea: 'tracking', idempotencyKey: 'tracking-tools-removed' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: category.auditId!, workKind: 'finalize' } }))
          .toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      expect(await loadTechnologyProfile(category.auditId!)).toMatchObject({ status: 'complete', technologies: [] })
      const fresh = await loadSiteHome(projectId)
      expect(fresh!.cards.find(card => card.id === 'tracking')?.sources).not.toContain('Vercel Analytics')
      expect(fresh!.technology?.items.some(item => item.name === 'Vercel Analytics')).toBe(true)
      expect(await prisma.siteTechnology.findFirst({ where: { site: { hostname: 'example.com' }, technology: { name: 'Vercel Analytics' }, isCurrent: true } })).not.toBeNull()
      expect(JSON.stringify(await loadTechnologyProfile(beforeId))).not.toContain('PRIVATE_TRACKING_PAYLOAD')
      expect(JSON.stringify([flag.evidenceTargets, receipts])).not.toContain('PRIVATE_ORIGINAL')
      expect(JSON.stringify(receipts)).not.toContain('PRIVATE_REPLACEMENT')
    } finally { trackingEnabled = true; trackingRepaired = false; trackingProject = trackingActionProject = 'PRIVATE_ORIGINAL'; transport.mockRestore() }
  }, 180_000)

  it('verifies checkout, sign-in and preview-image repairs through the real application, queue and worker', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await pauseExternalQueues()
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 }).catch(async error => {
        console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId: beforeId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
          select: { targetKey: true, workState: true, workErrorCode: true } }))
        throw error
      })
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: beforeId, workKind: 'browser' } })).toMatchObject({
        workResult: { data: { metadata: { forms: 0, totalFormInputs: 0,
          links: [{ href: 'checkout-destination', text: 'Subscribe', rel: null }, { href: 'login-destination', text: 'Log in', rel: null }],
          linkBaseUrl: destinationOrigin + '/nested/', ogImage: destinationOrigin + '/nested/preview.png',
          canonical: destinationOrigin + '/nested/canonical-target' }, snapshot: { renderedSearchSnapshot: { documentBaseUrl: destinationOrigin + '/nested/' } } } },
      })
      destinationsRepaired = true
      for (const checkId of ['checkout-link-dead', 'auth-page-broken', 'og-image-broken']) {
        destinationLarge = checkId === 'og-image-broken'
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId } })
        expect(flag.evidenceTargets).toMatchObject([{ kind: 'page', context: expect.stringMatching(/^destination:/) }])
        if (destinationLarge) {
          destinationsRepaired = false
          const unchangedFix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'large-image-unchanged-fix',
            changeSummary: 'Recheck the original image on a large page' })
          const unchangedRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'large-image-unchanged-verification',
            verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: unchangedFix.attemptId, parentAuditId: beforeId } })
          await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: unchangedRun.auditId! } }))
            .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 15_000, interval: 100 })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: unchangedFix.attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
          destinationsRepaired = true
        }
        destinationBasePath = '/other/'
        const changedFix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: checkId + '-changed-base-fix',
          changeSummary: 'Point the document base at another destination' })
        const changedRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: checkId + '-changed-base-verification',
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: changedFix.attemptId, parentAuditId: beforeId } })
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: changedRun.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: changedFix.attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ resolvedInId: null })
        destinationBasePath = '/nested/'
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: checkId + '-fix',
          changeSummary: 'Restore the original public destination' })
        const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: checkId + '-verification',
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
        if (destinationLarge) expect(tasks.find(task => task.workKind === 'browser')?.workResult).toMatchObject({ data: {
          metadata: null, snapshot: { desktopHtmlTruncated: true, runtimeHeadMetadata: { ogImage: destinationOrigin + '/nested/preview.png' } },
        } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:' + checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', assertion: { complete: true } })
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.auditId })
      }
      destinationLarge = false
      const canonical = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'search-canonical-target' } })
      expect(canonical.attentionPolicy).toMatchObject({ version: 3, reason: 'canonical_target_broken' })
      const canonicalFix = await recordSiteFlagFix({ siteId: projectId, flagId: canonical.id, userId, idempotencyKey: 'based-canonical-fix',
        changeSummary: 'Restore the declared canonical target' })
      const canonicalRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'based-canonical-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: canonical.pageUrl!, checkId: canonical.checkId!, attemptId: canonicalFix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: canonicalRun.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const canonicalProof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: canonicalRun.auditId!, targetKey: 'check:search-canonical-target' } })
      expect(searchVerifierSchema.parse(canonicalProof.detail)).toMatchObject({ verdict: 'passed', comparable: true })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: canonicalFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: canonical.id } })).toMatchObject({ status: 'FIXED', resolvedInId: canonicalRun.auditId })
      expect(requests).toContain('/nested/canonical-target')
    } finally { destinationsRepaired = false; destinationBasePath = '/nested/'; destinationLarge = false; transport.mockRestore() }
  }, 120_000)

  it('records public link evidence during discovery and independently verifies its exact repair through the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/public-links'
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
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
      const captures = await prisma.auditVerifierExecution.findMany({ where: { auditId: source.auditId!, workKind: 'browser', pageUrl: { in: [pageUrl, origin + '/public-links-peer'] } } })
      expect(captures).toHaveLength(2)
      for (const capture of captures) expect(capture.workResult).toMatchObject({ data: { metadata: null, snapshot: {
        desktopHtmlTruncated: true, renderedSearchSnapshot: { documentBaseUrl: origin + '/resolved/', sections: { links: { complete: true } } },
      } } })
      expect(requests).toContain('/resolved/public-links-gone')
      expect(requests).not.toContain('/inactive-fallback')
      expect(requests).not.toContain('/inert-template')
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
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
      expect(flag.evidenceTargets).toMatchObject([{ context: expect.stringMatching(/^section:v2:[a-f0-9]{64}:[a-f0-9]{64}$/) },
        { context: expect.stringMatching(/^section:v2:[a-f0-9]{64}:[a-f0-9]{64}$/) }])
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
      sectionLinksMode = 'inert'
      expect((await verify('inactive-targets')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
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

  it('retains native action, pricing, Tracking and Accessibility evidence through unavailable full metadata, repair and recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/independent-entry'
    const owner = userId + '-independent', site = projectId + '-independent'
    const checkIds = ['flow-cta-404', 'flow-pricing-nav-broken', 'tracking-library-http-error', 'buttons-no-text', 'mobile-input-zoom']
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, name: 'Independent native evidence', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      async function complete(auditId: string, broad = false) {
        await vi.waitFor(async () => {
          if (broad) {
            await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' }, OR: [
              { workKind: { in: ['captures', 'keyboard', 'motion', 'overlays', 'journeys', 'slow-replay', 'pagespeed', 'google', 'judge'] } },
              { workKind: 'flow', workInput: { path: ['module'], equals: 'form-validation' } },
              { workKind: 'flow', workInput: { path: ['module'], equals: 'mobile-navigation' } },
            ] }, data: { workRecoveryUntil: new Date(0) } })
            await dispatchReadyTasks(await reconcileTasks(auditId))
          }
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 40_000, interval: 200 })
      }
      async function broad(key: string) {
        const run = await requestSiteRun({ projectId: site, userId: owner, source: 'WATCH', scope: 'SITE', outcomeIds: [], idempotencyKey: 'independent:' + key })
        await complete(run.auditId!, true); return run.auditId!
      }
      independentActions = 'failed'
      const source = await broad('source')
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source, workKind: 'browser', pageUrl } })
      expect(readArtifact(browser.workResult, 'browser').data).toMatchObject({ metadata: null, snapshot: { desktopHtml: null, desktopHtmlTruncated: true,
        renderedCopy: { complete: true, pageText: expect.stringContaining('Useful service for your team'), h1s: ['Useful service for your team'] } } })
      const native = readArtifact(browser.workResult, 'browser').data as { snapshot: { accessibilityEvidence: { rules: unknown[] } } }
      expect(native.snapshot.accessibilityEvidence.rules).toContainEqual({ id: 'button-name', state: 'failed', nodes: 1 })
      const flags = await prisma.flag.findMany({ where: { auditId: source, checkId: { in: checkIds } } })
      expect(flags.map(flag => flag.checkId).sort()).toEqual([...checkIds].sort())
      const measurement = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source, targetKey: 'module:measurement', scopeKey: 'page:' + pageUrl } })
      expect(checkReceiptSchema.parse(measurement.detail)).toMatchObject({ complete: false, assertions: expect.arrayContaining([
        expect.objectContaining({ key: 'analytics-markup', complete: false }), expect.objectContaining({ key: 'tracking-library', complete: true, passed: false }),
      ]) })
      const accessibility = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source, targetKey: 'module:accessibility', scopeKey: 'page:' + pageUrl } })
      expect(checkReceiptSchema.parse(accessibility.detail)).toMatchObject({ complete: false, applicable: true, assertions: expect.arrayContaining([
        expect.objectContaining({ key: 'axe:buttons-no-text', complete: true, passed: false }),
        expect.objectContaining({ key: 'dom:buttons-no-text', complete: false, passed: false }),
      ]) })
      async function verify(flag: typeof flags[number], phase: string) {
        const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, idempotencyKey: 'independent-fix:' + flag.checkId + ':' + phase,
          changeSummary: 'Restore the original observed website behavior' })
        const run = await requestSiteRun({ projectId: site, userId: owner, source: 'WEB', outcomeIds: [], idempotencyKey: 'independent-verify:' + flag.checkId + ':' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source, attemptId: fix.attemptId } })
        await complete(run.auditId!)
        return { auditId: run.auditId!, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      const nativeFlag = flags.find(flag => flag.checkId === 'buttons-no-text')!
      expect((await verify(nativeFlag, 'unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      const primary = flags.find(flag => flag.checkId === 'flow-cta-404')!
      independentActions = 'missing'
      const removed = await verify(primary, 'removed')
      expect(removed.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.count({ where: { auditId: removed.auditId, checkId: 'flow-no-cta-found' } })).toBe(0)
      const absentReceipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: removed.auditId, targetKey: 'module:flow' } })
      expect(checkReceiptSchema.parse(absentReceipt.detail)).toMatchObject({ complete: false, applicable: true,
        assertions: expect.arrayContaining([expect.objectContaining({ key: 'primary-action-presence', complete: false })]) })
      independentActions = 'healthy'
      independentInventoryBound = true
      for (const flag of flags) {
        const repaired = await verify(flag, 'repaired')
        const observedSample = flag.checkId === 'mobile-input-zoom'
        expect(repaired.attempt, flag.checkId!).toMatchObject(observedSample
          ? { outcome: 'INCONCLUSIVE', comparable: false }
          : { outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject(observedSample
          ? { status: 'OPEN', resolvedInId: null }
          : { status: 'FIXED', resolvedInId: repaired.auditId })
        if (flag.checkId === 'buttons-no-text') {
          const observed = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, targetKey: 'module:accessibility' } })
          expect(checkReceiptSchema.parse(observed.detail)).toMatchObject({ complete: false, passed: false, assertions: expect.arrayContaining([
            expect.objectContaining({ key: 'axe:buttons-no-text', complete: true, passed: true }),
            expect.objectContaining({ key: 'dom:buttons-no-text', complete: false, passed: false }),
          ]) })
          const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, targetKey: 'check:buttons-no-text' } })
          expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'browser-accessibility' })
        }
        if (flag.checkId === 'flow-pricing-nav-broken') expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: repaired.auditId, workKind: { not: null } } })).map(task => task.workKind).sort()).toEqual(['finalize', 'flow'])
        else {
          const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, workKind: 'browser', pageUrl } })
          expect(browser).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
          expect(readArtifact(browser.workResult, 'browser').data).toMatchObject({ metadata: null, snapshot: { desktopHtmlTruncated: false,
            renderedCopy: { complete: true, h1s: ['Useful service for your team'] } } })
        }
      }
      independentActions = 'failed'
      const recurrence = await broad('recurrence')
      const response = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: recurrence, workKind: 'http', pageUrl } })
      expect(response).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      expect(readArtifact(response.workResult, 'http').data).toMatchObject({ metadata: null, document: { complete: true, status: 200 } })
      for (const flag of flags) {
        const again = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence, checkId: flag.checkId } })
        const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
        const observedSample = flag.checkId === 'mobile-input-zoom'
        expect(again).toMatchObject(observedSample
          ? { status: 'OPEN', fingerprint: flag.fingerprint }
          : { status: 'REGRESSED', fingerprint: flag.fingerprint })
        expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: again.id } })).toMatchObject(observedSample
          ? { improvementId: original.improvementId, kind: 'OBSERVED' }
          : { improvementId: original.improvementId })
      }
    } finally { independentActions = 'failed'; independentInventoryBound = false; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 180_000)

  it('independently verifies original pricing navigation and preserves recurrence through monitoring', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/pricing-navigation'
    const owner = userId + '-pricing', site = projectId + '-pricing'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, name: 'Pricing navigation repair', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      async function broad(key: string) {
        const run = await requestSiteRun({ projectId: site, userId: owner, source: 'WATCH', scope: 'SITE', outcomeIds: [], idempotencyKey: 'pricing:' + key })
        await vi.waitFor(async () => {
          await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!, workState: { not: 'COMPLETED' }, OR: [
            { workKind: { in: ['captures', 'keyboard', 'motion', 'overlays', 'journeys', 'slow-replay', 'pagespeed', 'google', 'judge'] } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'form-validation' } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'mobile-navigation' } },
          ] }, data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(run.auditId!))
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 40_000, interval: 200 })
        return run
      }
      pricingMode = 'broken'
      const source = await broad('source')
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'flow-pricing-nav-broken' } })
      expect(flag).toMatchObject({ verificationRule: expect.stringContaining('Public pricing navigation v1'), evidenceTargets: [{ context: expect.stringMatching(/^flow:pricing:v1:/) }] })
      const flowReceipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: source.auditId!, targetKey: 'module:flow' } })
      expect(flowReceipts.map(row => checkReceiptSchema.parse(row.detail).assertions).flat()).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'pricing-navigation', passed: false, complete: true }),
        expect.objectContaining({ key: 'primary-action-click', passed: true, complete: true }),
      ]))
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId! } })).flowData).toMatchObject({ ctaText: 'Get started' })
      async function verify(key: string) {
        const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, idempotencyKey: 'pricing-fix:' + key, changeSummary: 'Restore the original pricing navigation' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site, flagId: flag.id, userId: owner, attemptId: fix.attemptId, source: 'MCP', idempotencyKey: 'pricing-verify:' + key })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Pricing verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 20_000, interval: 100 })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, workKind: { not: null } } })).map(task => task.workKind).sort()).toEqual(['finalize', 'flow'])
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      expect((await verify('unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      for (const mode of ['missing', 'changed', 'challenge', 'redirect'] as const) {
        pricingMode = mode
        expect((await verify(mode)).attempt, mode).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      }
      pricingMode = 'competing'
      expect((await verify('competing')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      pricingMode = 'healthy'
      const repaired = await verify('repaired')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await getOwnedRun(owner, repaired.run.runId)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.verificationAuditId })
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      pricingMode = 'broken'
      const recurrence = await broad('recurrence')
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'flow-pricing-nav-broken' }, include: { improvementOccurrence: true } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: occurrence.improvementId } })
      pricingMode = 'healthy'
      const independent = await broad('recovery')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: repeated.id } })).toMatchObject({ status: 'FIXED', resolvedInId: independent.auditId })
      expect(await prisma.improvementAttempt.count({ where: { sourceAuditId: recurrence.auditId!, improvementId: occurrence.improvementId } })).toBe(0)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.verificationAuditId })
    } finally { pricingMode = 'broken'; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 150_000)

  it('commits native post-click timing facts and distinguishes unavailable provider work from destination loading', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/post-click-entry'
    const owner = userId + '-post-click', site = projectId + '-post-click'
    const ownedAudits = new Set<string>()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, name: 'Post-click timing fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      for (const mode of ['delayed', 'fast', 'pending'] as const) {
        const delay = mode === 'delayed' ? 3300 : 0
        postClickEarly = mode === 'pending'
        postClickDelayMs = delay
        const admitted = await requestSiteRun({ projectId: site, userId: owner, scope: 'SITE', source: 'WATCH', outcomeIds: [], idempotencyKey: 'post-click:' + mode })
        ownedAudits.add(admitted.auditId!)
        let primaryCompletedBeforeLinks = false
        await vi.waitFor(async () => {
          const primaryFinished = mode === 'pending' && Boolean(await prisma.auditVerifierExecution.findFirst({ where: {
            auditId: admitted.auditId!, targetKey: 'task:p0:flow', workState: 'COMPLETED' } }))
          if (primaryFinished && !primaryCompletedBeforeLinks) {
            expect(await prisma.auditVerifierExecution.count({ where: { auditId: admitted.auditId!, workKind: 'browser',
              workInput: { path: ['primary'], equals: false }, workState: { in: ['WAITING', 'READY', 'RUNNING'] } } })).toBeGreaterThan(0)
            primaryCompletedBeforeLinks = true
          }
          // Bound deliberately unavailable secondary recovery only after the
          // real primary action publishes independently of those linked pages.
          await prisma.auditVerifierExecution.updateMany({ where: { auditId: admitted.auditId!, workState: { not: 'COMPLETED' }, OR: [
            { workKind: { in: ['captures', 'keyboard', 'motion', 'overlays', 'journeys', 'slow-replay', 'pagespeed', 'google', 'judge'] } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'form-validation' } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'mobile-navigation' } },
            ...(primaryFinished ? [{ workKind: 'browser', workInput: { path: ['primary'], equals: false } }] : []),
          ] }, data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(admitted.auditId!))
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 200 }).catch(async error => {
          const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: admitted.auditId!, targetKey: { startsWith: 'task:' }, workState: { not: 'COMPLETED' } },
            select: { targetKey: true, workState: true, workErrorCode: true } })
          throw new Error(JSON.stringify({ mode, tasks }), { cause: error })
        })
        if (mode === 'pending') expect(primaryCompletedBeforeLinks).toBe(true)
        const flow = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: admitted.auditId!, targetKey: 'task:p0:flow' } })
        expect(flow.workState).toBe('COMPLETED')
        const result = (readArtifact(flow.workResult, 'flow').data as { result: FlowScanResult }).result
        expect(result.postClickMetrics).toMatchObject({ version: 2, contentComplete: true, loadingComplete: true, pageUrl: origin + '/post-click-destination' })
        expect(result.postClickMetrics!.timeToFirstContentMs! > 3000).toBe(delay > 3000)
        expect((await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })).flowData).toMatchObject({ postClickMetrics: result.postClickMetrics })
        const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: admitted.auditId!, targetKey: 'module:flow', scopeKey: 'page:' + pageUrl } })
        expect(checkReceiptSchema.parse(receipt.detail).complete).toBe(mode !== 'pending')
        expect(checkReceiptSchema.parse(receipt.detail).assertions).toEqual(expect.arrayContaining([
          expect.objectContaining({ key: 'destination-content-timing', complete: true, passed: delay === 0, context: expect.stringMatching(/^flow:loading:v2:/) }),
          expect.objectContaining({ key: 'destination-loading-ui', complete: true, passed: delay === 0, context: expect.stringMatching(/^flow:loading:v2:/) }),
        ]))
        expect(await prisma.flag.count({ where: { auditId: admitted.auditId!, checkId: 'flow-cta-blank-destination' } })).toBe(delay > 3000 ? 1 : 0)
        if (mode === 'pending') expect(await prisma.flag.count({ where: { auditId: admitted.auditId!, checkId: 'flow-destination-no-cta' } })).toBe(0)
      }
    } finally {
      postClickDelayMs = 0; postClickEarly = false
      await Promise.allSettled([...postClickPendingRoutes].map(route => route.abort('aborted')))
      postClickPendingRoutes.clear()
      await prisma.user.delete({ where: { id: owner } })
      await vi.waitFor(async () => {
        const active = await getAuditTaskQueue('browser').getJobs(['active'])
        expect(active.filter(job => ownedAudits.has(job.data.auditId))).toHaveLength(0)
      }, { timeout: 10_000, interval: 100 })
      transport.mockRestore()
    }
  }, 90_000)

  it('verifies destination loading on the original action through uncertainty, repair and monitored recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/post-click-entry'
    const owner = userId + '-post-click-repair', site = projectId + '-post-click-repair'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, name: 'Destination loading repair', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      async function broad(key: string) {
        const run = await requestSiteRun({ projectId: site, userId: owner, source: 'WATCH', scope: 'SITE', outcomeIds: [], idempotencyKey: key })
        await vi.waitFor(async () => {
          await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!, workState: { not: 'COMPLETED' }, OR: [
            { workKind: { in: ['captures', 'keyboard', 'motion', 'overlays', 'journeys', 'slow-replay', 'pagespeed', 'google', 'judge'] } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'form-validation' } },
            { workKind: 'flow', workInput: { path: ['module'], equals: 'mobile-navigation' } },
          ] }, data: { workRecoveryUntil: new Date(0) } })
          await dispatchReadyTasks(await reconcileTasks(run.auditId!))
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 40_000, interval: 200 })
        return run
      }
      postClickDelayMs = 3300; postClickReplayMode = 'normal'
      const source = await broad('post-click-source')
      const flags = await prisma.flag.findMany({ where: { auditId: source.auditId!, checkId: { in: ['flow-cta-blank-destination', 'flow-cta-stuck-loading', 'flow-destination-slow-load'] } } })
      expect(flags.map(flag => flag.checkId).sort()).toEqual(['flow-cta-blank-destination', 'flow-cta-stuck-loading', 'flow-destination-slow-load'].sort())
      for (const flag of flags) expect(flag).toMatchObject({ verificationRule: POST_CLICK_VERIFICATION_RULE,
        evidenceTargets: [{ context: expect.stringMatching(/^flow:loading:v2:/) }] })
      const delayed = flags.find(flag => flag.checkId === 'flow-cta-blank-destination')!, stuck = flags.find(flag => flag.checkId === 'flow-cta-stuck-loading')!
      async function verify(flag: typeof delayed, key: string) {
        const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, idempotencyKey: 'post-fix:' + key, changeSummary: 'Restore promptly usable content on the original destination' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site, flagId: flag.id, userId: owner, attemptId: fix.attemptId, source: 'MCP', idempotencyKey: 'post-verify:' + key })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Destination loading verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 20_000, interval: 100 }).catch(async error => {
          const [audit, tasks] = await Promise.all([
            prisma.audit.findUnique({ where: { id: run.verificationAuditId! }, select: { status: true, failureCode: true, improvementProjectedAt: true } }),
            prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, targetKey: { startsWith: 'task:' } },
              select: { targetKey: true, workKind: true, workState: true, workErrorCode: true, workAttempts: true } }),
          ])
          throw new Error(JSON.stringify({ key, audit, tasks }), { cause: error })
        })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, workKind: { not: null } } })).map(task => task.workKind).sort()).toEqual(['browser', 'finalize', 'flow'])
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      expect((await verify(delayed, 'unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      for (const mode of ['missing', 'changed', 'redirect', 'challenge'] as const) {
        postClickReplayMode = mode
        expect((await verify(delayed, mode)).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      }
      postClickReplayMode = 'competing'
      expect((await verify(delayed, 'competing')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      postClickReplayMode = 'blank'
      expect((await verify(stuck, 'blank')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      postClickReplayMode = 'normal'; postClickDelayMs = 0
      for (const flag of flags) {
        const fixed = await verify(flag, 'repaired:' + flag.checkId)
        expect(fixed.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await getOwnedRun(owner, fixed.run.runId)).toMatchObject({ result: 'CLEAR' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: fixed.run.verificationAuditId })
      }
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: delayed.id } })
      postClickDelayMs = 3300
      const recurrence = await broad('post-click-recurrence')
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: delayed.checkId }, include: { improvementOccurrence: true } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: occurrence.improvementId } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: delayed.id } })).toMatchObject({ status: 'FIXED' })
      postClickDelayMs = 0
      const independent = await broad('post-click-independent-recovery')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: repeated.id } })).toMatchObject({ status: 'FIXED', resolvedInId: independent.auditId })
      expect(await prisma.improvementAttempt.count({ where: { sourceAuditId: recurrence.auditId!, improvementId: occurrence.improvementId } })).toBe(0)
    } finally { postClickDelayMs = 0; postClickReplayMode = 'normal'; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 200_000)

  it('verifies the original primary action through honest gaps, repair and recurrence using real Chromium and the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/primary-action'
    const owner = userId + '-primary', site = projectId + '-primary'
    try {
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: site, userId: owner, name: 'Primary action fixture', url: pageUrl, canonicalHost: 'example.com' } })
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
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
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: source.auditId!, targetKey: 'module:flow', scopeKey: 'page:' + pageUrl } }))
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
    const providerWasPaused = await Promise.all(externalQueues.map(resource => getAuditTaskQueue(resource).isPaused()))
    const previousPageSpeedMode = pageSpeedMode
    const owner = userId + '-controls', site = projectId + '-controls'
    try {
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: site, userId: owner, name: 'Primary control fixture', url: pageUrl, canonicalHost: 'example.com' } })
      await getAuditTaskQueue('browser').resume()
      for (const [mode, checkId, kind] of [
        ['missing', 'flow-no-cta-found', 'button'], ['disabled', 'flow-cta-unclickable', 'button'], ['disabled', 'flow-cta-unclickable', 'role'], ['deadend', 'flow-cta-dead-end', 'link'],
        ['deadend', 'flow-cta-dead-end', 'undeclared-link'],
        ['disabled', 'flow-cta-unclickable', 'input-button'], ['disabled', 'flow-cta-unclickable', 'input-submit'],
      ] as const) {
        primaryControlMode = mode; primaryControlKind = kind === 'undeclared-link' ? 'link' : kind
        primaryControlDeclared = kind !== 'undeclared-link'
        const session = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, deadline: Date.now() + 20_000 })
        let flags
        try {
          const observed = await runFlowScan(session.page, 'primary-control-source', pageUrl, { mode: 'primary', captureSteps: false, deadlineMs: 12_000 })
          flags = runFlowChecks(observed).map(flag => ({ ...flag, pageUrl }))
          expect(flags.map(flag => flag.checkId), JSON.stringify({ mode, kind, observed })).toContain(checkId)
          expect(observed.actionEvidence).toBeDefined()
        } finally { session.disposeNetwork(); await session.page.context().close() }
        const source = await prisma.audit.create({ data: { projectId: site, userId: owner, url: pageUrl, status: 'COMPLETED', isPublic: false,
          startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: { version: 1, engine: 'progressive-v1',
            targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: Object.fromEntries(PRIMARY_ACTION_CHECKS.map(id => [id, 1])), outcomes: [], verificationTarget: null } } })
        await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
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
        if (kind === 'undeclared-link') {
          primaryControlMode = 'deadend'
          await resumeExternalQueues(); pageSpeedMode = 'refused'
          const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
          const recurring = await requestScheduledSiteRun({ projectId: site, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
          await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: recurring.auditId! } }))
            .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 100 })
          const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId } })
          expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
          const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
          expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
            .toMatchObject({ improvementId: original.improvementId })
        }
      }
    } finally {
      primaryControlMode = 'missing'; primaryControlKind = 'button'; primaryControlDeclared = true; pageSpeedMode = previousPageSpeedMode
      await Promise.all(externalQueues.map((resource, index) => providerWasPaused[index] ? getAuditTaskQueue(resource).pause() : getAuditTaskQueue(resource).resume()))
      transport.mockRestore()
    }
  }, 180_000)

  it('preserves Checkout failure, independent repair and recurrence when optional media is unavailable', async () => {
    const transport = fixtureTransport()
    const browserWasPaused = await getAuditTaskQueue('browser').isPaused()
    const media = vi.spyOn(integrityStorage, 'uploadIntegrityArtifact').mockImplementation(async () => {
      expect(getBrowserDiagnostics().activeContexts).toBe(0)
      throw new Error('Fixture private storage unavailable')
    })
    try {
      await getAuditTaskQueue('browser').resume()
      const outcome = await prisma.siteOutcome.create({ data: { projectId, slug: 'checkout-media', name: 'Customers reach checkout', kind: 'CHECKOUT',
        confirmedAt: new Date(), bindings: { create: { key: 'checkout-media-v1', mechanism: 'BROWSER_JOURNEY', required: true,
          config: { startUrl: origin + '/purchase-entry', steps: [{ action: 'wait', waitMs: 1000 }],
            goal: { type: 'url_pattern', pattern: '/checkout' }, safety: 'stop-at-checkout' } } } } })
      const audits: string[] = []
      let attemptId = ''
      for (const [index, healthy] of [false, true, false].entries()) {
        checkoutJourneyHealthy = healthy
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'checkout-media-cycle:' + index })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: run.runId } })).toMatchObject({ status: 'COMPLETED' })
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 25_000, interval: 100 }).catch(async error => {
          console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, workKind: { not: null } },
            select: { targetKey: true, workState: true, workErrorCode: true } }))
          throw error
        })
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: run.runId, outcomeId: outcome.id } } })
        expect(assessment.state).toBe(healthy ? 'CLEAR' : 'FLAG')
        const execution = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId: run.auditId!, outcomeId: outcome.id } })
        expect(execution).toMatchObject({ disposition: healthy ? 'SUCCEEDED' : 'FAILED', reason: healthy ? 'checkout_reached' : 'add_to_cart_noop' })
        const journey = await prisma.journeyReview.findFirstOrThrow({ where: { auditId: run.auditId!, journeyType: 'checkout' }, include: { steps: true } })
        expect(journey.goalAchieved).toBe(healthy)
        if (healthy) expect(journey.steps.find(step => step.actionType === 'checkout')?.actionDetail).toMatchObject({ destinationUrl: origin + '/checkout' })
        expect(journey.steps.every(step => step.screenshotAfterUrl === null)).toBe(true)
        expect(media.mock.calls.some(call => new RegExp('^outcome-' + run.runId + '-checkout-media-v1-g[1-9][0-9]*$').test(call[0]))).toBe(true)
        if (index === 0) {
          const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, fingerprint: 'outcome:v1:' + outcome.id + ':checkout-media-v1' } })
          attemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
            idempotencyKey: 'checkout-media-fix', changeSummary: 'Restore cart entry and the public checkout link' })).attemptId
        }
      }
      const original = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[0], fingerprint: 'outcome:v1:' + outcome.id + ':checkout-media-v1' }, include: { improvementOccurrence: true } })
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[2], fingerprint: 'outcome:v1:' + outcome.id + ':checkout-media-v1' }, include: { improvementOccurrence: true } })
      expect(original).toMatchObject({ status: 'FIXED', resolvedInId: audits[1] })
      expect(recurred).toMatchObject({ status: 'REGRESSED', fingerprint: original.fingerprint })
      expect(recurred.improvementOccurrence?.improvementId).toBe(original.improvementOccurrence?.improvementId)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: audits[1] })
    } finally {
      checkoutJourneyHealthy = false; media.mockRestore(); transport.mockRestore()
      if (browserWasPaused) await getAuditTaskQueue('browser').pause()
    }
  }, 100_000)

  it('observes delayed signup completion and preserves actionable failure, uncertainty, repair and recurrence', async () => {
    const transport = fixtureTransport()
    const browserWasPaused = await getAuditTaskQueue('browser').isPaused()
    try {
      await getAuditTaskQueue('browser').resume()
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
    } finally {
      signupMode = 'success'; signupCleanupOk = true; transport.mockRestore()
      if (browserWasPaused) await getAuditTaskQueue('browser').pause()
    }
  }, 60_000)

  it('preserves the latest Watch delivery across stale readers and expired senders using the real notification ledger', async () => {
    const originalName = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name
    const originalRecoveryPreference = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).notifyOnRecovery
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
      notificationBoundary.provider = new Resend('re_fixture_not_a_real_key')
      providerTransport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        if (url.origin !== 'https://api.resend.com') return forwardedFetch(input, options)
        if (url.pathname !== '/emails') throw new Error('Unexpected fixture provider operation')
        providerRequests.push({ key: new Headers(options?.headers).get('Idempotency-Key'), body: JSON.parse(String(options?.body)) })
        return await (providerResponses.shift() ?? accepted())
      })
      // Earlier tests leave genuine Watch results pending while the provider is
      // unavailable. Settle their real delivery intents before measuring this
      // bounded retry scenario. No previous classification or evidence is reset.
      const earlier = await prisma.audit.findMany({ where: { status: 'COMPLETED', recheckTrigger: 'WATCH',
        improvementProjectedAt: { not: null }, user: { lifecycleStatus: 'ACTIVE' },
        project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
        watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
        watchNotificationAttempts: { lt: prisma.audit.fields.watchNotificationAttemptCeiling } }, select: { id: true, parentId: true } })
      for (const audit of earlier) await notifyWatchRegression(audit.parentId, audit.id)
      expect(await prisma.audit.count({ where: { id: { in: earlier.map(audit => audit.id) },
        watchNotificationStatus: { in: ['PENDING', 'FAILED', 'SENDING'] } } })).toBe(0)
      providerRequests.length = 0
      const firstAcceptance = deferred<Response>()
      heldResponses.push(firstAcceptance)
      providerResponses.push(firstAcceptance.promise)
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
      // The worker must commit useful results without waiting for email acceptance.
      const completed = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      expect(completed).toMatchObject({ watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
      expect(providerRequests).toHaveLength(0)
      const backgroundDelivery = notifyWatchRegression(null, auditId)
      deliveries.push(backgroundDelivery)
      await vi.waitFor(() => expect(providerRequests).toHaveLength(1), { timeout: 3000, interval: 20 })
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({
        improvementProjectedAt: completed.improvementProjectedAt, watchNotificationStatus: 'SENDING',
      })
      firstAcceptance.resolve(accepted())
      await backgroundDelivery
      expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENT' })
      providerRequests.length = 0
      async function resetDelivery() {
        // Reset only this fixture's operational delivery state. Website evidence,
        // incident identity and the committed comparison remain unchanged.
        await prisma.audit.update({ where: { id: auditId }, data: { watchRegressionCount: null, watchRecoveryCount: null,
          watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotifiedAt: null,
          watchNotificationLeaseUntil: null, watchNotificationLastError: null } })
      }
      // Exercise the entry points with genuine committed comparison evidence.
      // Neither historical facts nor a queued alert complete an unfinished run.
      for (const invalid of [
        { status: 'QUEUED' as const }, { status: 'CHECKING' as const }, { status: 'FAILED' as const },
        { completedAt: null }, { improvementProjectedAt: null },
      ]) {
        await resetDelivery()
        await prisma.audit.update({ where: { id: auditId }, data: invalid })
        await prisma.project.update({ where: { id: projectId }, data: { watchLastRunAt: new Date(0) } })
        if (!('improvementProjectedAt' in invalid)) await classifyWatchResult(null, auditId)
        await notifyWatchRegression(null, auditId)
        expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: new Date(0) })
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({
          watchRegressionCount: null, watchRecoveryCount: null, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
        expect(providerRequests).toHaveLength(0)
        await prisma.audit.update({ where: { id: auditId }, data: {
          status: completed.status, completedAt: completed.completedAt, improvementProjectedAt: completed.improvementProjectedAt } })
      }
      await prisma.audit.update({ where: { id: auditId }, data: { improvementProjectedAt: null } })
      await classifyWatchResult(null, auditId)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({
        watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: completed.completedAt })
      expect(providerRequests).toHaveLength(0)
      await prisma.audit.update({ where: { id: auditId }, data: { improvementProjectedAt: completed.improvementProjectedAt } })
      await resetDelivery()
      const originalReader = prisma.audit.findUnique.bind(prisma.audit)
      let readHeld = deferred<void>()
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
      const heldReader = reader.getMockImplementation()!
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

      const alternateOwner = userId + '-notification-owner'
      await prisma.user.create({ data: { id: alternateOwner, email: alternateOwner + '@example.test' } })
      for (const change of ['preferences', 'account', 'site', 'recipient', 'owner', 'ceiling', 'status', 'undated', 'projection'] as const) {
        await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
        await resetDelivery()
        await prisma.project.update({ where: { id: projectId }, data: { watchLastRunAt: new Date(0) } })
        readHeld = deferred<void>()
        releaseRead = deferred<void>()
        holdNextRead = true
        reader = vi.spyOn(prisma.audit, 'findUnique').mockImplementation(heldReader)
        const sending = notifyWatchRegression(null, auditId)
        deliveries.push(sending)
        await readHeld.promise
        if (change === 'preferences') await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'OFF' } })
        if (change === 'account') await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'site') await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
        if (change === 'recipient') await prisma.user.update({ where: { id: userId }, data: { email: 'changed-' + userId + '@example.test' } })
        if (change === 'owner') await prisma.project.update({ where: { id: projectId }, data: { userId: alternateOwner } })
        if (change === 'ceiling') await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationAttemptCeiling: 0 } })
        if (change === 'status') await prisma.audit.update({ where: { id: auditId }, data: { status: 'FAILED' } })
        if (change === 'undated') await prisma.audit.update({ where: { id: auditId }, data: { completedAt: null } })
        if (change === 'projection') await prisma.audit.update({ where: { id: auditId }, data: { improvementProjectedAt: null } })
        releaseRead.resolve(); await sending
        reader.mockRestore(); reader = undefined
        expect(providerRequests).toHaveLength(5)
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
          .toMatchObject({ watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationLeaseUntil: null })
        if (['account', 'site', 'owner', 'status', 'undated', 'projection'].includes(change)) {
          expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: new Date(0) })
        }
        if (change !== 'ceiling') expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
          .toMatchObject({ watchRegressionCount: null, watchRecoveryCount: null })
        await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS', deletedAt: null, userId } })
        await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE', email: userId + '@example.test' } })
        await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationAttemptCeiling: 5,
          status: completed.status, completedAt: completed.completedAt, improvementProjectedAt: completed.improvementProjectedAt } })
      }

      // Older ineligible rows cannot consume the bounded retry batch. These
      // fixture records supply no passing website or comparison evidence.
      const inactiveOwner = userId + '-inactive'
      await prisma.user.create({ data: { id: inactiveOwner, email: inactiveOwner + '@example.test', lifecycleStatus: 'SUSPENDED' } })
      const unavailableProjects = [projectId + '-inactive', projectId + '-removed']
      for (const [index, id] of unavailableProjects.entries()) {
        const ownerId = index ? alternateOwner : inactiveOwner
        await prisma.project.create({ data: { id, userId: ownerId, name: 'Ineligible notification fixture', canonicalHost: 'example.com', url: origin,
          ...(index ? { deletedAt: new Date() } : {}) } })
        const old = new Date('2026-01-01T00:00:00Z')
        await prisma.audit.createMany({ data: Array.from({ length: 20 }, () => ({ url: origin, userId: ownerId, projectId: id,
          status: 'COMPLETED' as const, recheckTrigger: 'WATCH' as const, completedAt: old, improvementProjectedAt: old,
          createdAt: old, updatedAt: old, watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING' as const })) })
      }
      await resetDelivery()
      const corrupt = await prisma.audit.create({ data: { url: origin, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
        completedAt: new Date('2026-01-01T00:00:00Z'), improvementProjectedAt: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
        watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'SENDING', watchNotificationLeaseUntil: null,
        verifierExecutions: { create: { targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product', source: 'DETERMINISTIC',
          status: 'COMPLETED', detail: { kind: 'malformed-fixture-comparison' } } } } })
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      expect(providerRequests).toHaveLength(5)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: corrupt.id } })).toMatchObject({
        watchNotificationStatus: 'SENDING', watchNotificationAttempts: 0, watchNotificationLastError: 'Notification classification could not complete' })
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      expect(providerRequests).toHaveLength(6)
      expect(providerRequests[5].body.html).toContain(`/sites/${projectId}/flags/${flag.id}?source=watch-email`)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1 })

      // A historical body has no selected finding identities. Restrictive
      // preferences admit a fresh scoped intent while retaining that body.
      // The existing genuine availability Flag and comparison stay unchanged.
      const stored = watchEmailPayloadSchema.parse((await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).watchNotificationPayload)
      const legacy = { version: 1 as const, ...watchEmailProviderBody(stored) }
      await resetDelivery()
      await prisma.audit.update({ where: { id: auditId }, data: { watchNotificationPayload: legacy } })
      await prisma.project.update({ where: { id: projectId }, data: { notifyOnRecovery: false } })
      await prisma.user.update({ where: { id: userId }, data: { name: 'Current notification owner' } })
      providerResponses.push(rejected())
      await notifyWatchRegression(null, auditId)
      expect(providerRequests).toHaveLength(7)
      const revised = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      expect(revised).toMatchObject({ watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1 })
      const revisedPayload = watchEmailPayloadSchema.parse(revised.watchNotificationPayload)
      expect(revisedPayload.selection).toEqual({ projectId, regressions: ['id:' + flag.id], recoveries: [] })
      expect(revisedPayload.previous).toEqual([legacy])
      expect(providerRequests[6].key).toBe(revisedPayload.deliveryKey)
      expect(providerRequests[6].key).not.toBe(`fixflags-watch-${auditId}-v1`)
      expect(providerRequests[6].body.html).toContain(`/sites/${projectId}/flags/${flag.id}?source=watch-email`)
      await prisma.user.update({ where: { id: userId }, data: { name: 'Later notification owner' } })
      await notifyWatchRegression(null, auditId)
      expect(providerRequests).toHaveLength(8)
      expect(providerRequests[7]).toEqual(providerRequests[6])
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({
        watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationPayload: revisedPayload })

      // Missing historical leases have no active owner. Reclaim the same frozen
      // intent through the actual bounded sweep and installed provider SDK.
      await prisma.audit.update({ where: { id: auditId }, data: {
        watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1,
        watchNotificationLeaseUntil: null, watchNotifiedAt: null,
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      } })
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      expect(providerRequests).toHaveLength(9)
      expect(providerRequests[8]).toEqual(providerRequests[7])
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({
        watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationPayload: revisedPayload })

      await prisma.audit.update({ where: { id: auditId }, data: {
        watchNotificationStatus: 'SENDING', watchNotificationAttempts: 5,
        watchNotificationAttemptCeiling: 5, watchNotificationLeaseUntil: null,
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      } })
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      const exhausted = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      expect(exhausted).toMatchObject({ watchNotificationStatus: 'FAILED', watchNotificationAttempts: 5 })
      expect(watchAlertDelivery({ status: exhausted.watchNotificationStatus, attempts: exhausted.watchNotificationAttempts,
        attemptCeiling: exhausted.watchNotificationAttemptCeiling, leaseUntil: exhausted.watchNotificationLeaseUntil })).toBe('undelivered')
      expect(providerRequests).toHaveLength(9)

      await prisma.audit.update({ where: { id: auditId }, data: {
        watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1, watchNotificationLeaseUntil: null,
      } })
      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'OFF' } })
      await notifyWatchRegression(null, auditId)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ watchNotificationStatus: 'NOT_APPLICABLE' })
      expect(providerRequests).toHaveLength(9)
    } finally {
      releaseRead?.resolve()
      heldResponses.forEach(response => response.resolve(rejected()))
      await Promise.allSettled(deliveries)
      reader?.mockRestore(); providerTransport?.mockRestore(); notificationBoundary.provider = null
      await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS', deletedAt: null, userId,
        notifyOnRecovery: originalRecoveryPreference } })
      await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE', email: userId + '@example.test', name: originalName } })
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

  it('verifies an original HTTP page through failed page responses, HTTPS redirection and monitoring recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = 'http://example.com/transport'
    try {
      const document = await collectDocument(pageUrl, Date.now() + 8000)
      const metadata = parseMetadataFromHtml(document.body!, document.finalUrl)
      const checked = await runAllChecks(document.finalUrl, metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['security'])
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, isPublic: false, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
        executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, checked.flags.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'no-https' } })
      for (const mode of ['http', 'unavailable', 'https'] as const) {
        transportMode = mode
        const fixed = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'transport-fix:' + mode,
          changeSummary: 'Enable HTTPS and redirect the original page' })
        const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, flagId: flag.id, userId, attemptId: fixed.attemptId,
          source: 'MCP', idempotencyKey: 'transport-verify:' + mode })
        if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Transport verification was not admitted')
        await vi.waitFor(async () => { expect(await prisma.audit.findUnique({ where: { id: admitted.verificationAuditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }) }, { timeout: 15_000, interval: 100 })
        const expected = mode === 'https' ? 'IMPROVED' : 'UNCHANGED'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: expected, comparable: true })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: admitted.verificationAuditId, workKind: { not: null } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: mode === 'https' ? 'FIXED' : 'OPEN' })
      }
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      transportMode = 'http'
      const again = await requestSiteRun({ projectId, userId, scope: 'SITE', url: pageUrl, source: 'WATCH', outcomeIds: [], idempotencyKey: 'transport-recurrence' })
      // Browser and provider queues remain paused. Their missing observations
      // expire honestly without preventing independent transport recurrence.
      await vi.waitFor(async () => {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: again.auditId!, workKind: { notIn: ['http', 'check', 'finalize', 'discovery'] },
          workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(again.auditId!))
        expect(await prisma.audit.findUnique({ where: { id: again.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 20_000, interval: 100 })
      expect(await prisma.flag.findFirstOrThrow({ where: { auditId: again.auditId!, checkId: 'no-https' }, include: { improvementOccurrence: true } }))
        .toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: occurrence.improvementId } })
      expect((await loadSiteHome(projectId))!.cards.find(card => card.id === 'security')).toMatchObject({ state: 'problem', openFlagCount: 1 })
    } finally { transportMode = 'http'; transport.mockRestore() }
  }, 60_000)

  it('projects current public transport evidence into Site Security health through the real worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/security-coverage'
    const owner = userId + '-security-coverage', site = projectId + '-security-coverage'
    try {
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
      await prisma.project.create({ data: { id: site, userId: owner, url: pageUrl, canonicalHost: 'example.com', name: 'Security coverage fixture' } })
      await getAuditTaskQueue('browser').resume()
      // The prior Site identity supplies category admission, not passing evidence.
      const baseline = await prisma.audit.create({ data: { projectId: site, userId: owner, url: pageUrl, isPublic: false, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { 'no-https': 1, 'security-mixed-content': 1 }, outcomes: [], verificationTarget: null } } })
      const admitted = await requestSiteRun({ projectId: site, userId: owner, scope: 'CATEGORY', categoryArea: 'security', outcomeIds: [], source: 'WEB',
        idempotencyKey: 'security-coverage-native' })
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: admitted.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 25_000, interval: 100 })
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! }, include: { flags: true, verifierExecutions: true } })
      expect(readExecutionSpec(audit.executionSpec)?.category?.sourceAuditId).toBe(baseline.id)
      const receipt = audit.verifierExecutions.find(row => row.targetKey === 'module:security')!
      expect(receipt.detail).toMatchObject({ complete: true, assertions: expect.arrayContaining([
        expect.objectContaining({ key: 'resource-transport', passed: true, complete: true }),
      ]) })
      const facts = buildCoverageFacts({ auditStatus: audit.status, completedAt: audit.completedAt, now: new Date(),
        evidenceCoverage: audit.evidenceCoverage, flags: audit.flags, verifierExecutions: audit.verifierExecutions })
      expect(facts.find(fact => fact.area === 'security')).toMatchObject({ state: 'healthy', evidenced: true })
      expect((await loadSiteHome(site))!.cards.find(card => card.id === 'security')).toMatchObject({ state: 'healthy', openFlagCount: 0 })
    } finally { transport.mockRestore() }
  }, 35_000)

  it('independently verifies every originally failed response header through HTTP, the task ledger and fix projection', async () => {
    const transport = fixtureTransport()
    try {
      const pageUrl = origin + '/headers'
      headerMode = 'failed'
      const observed = await collectDocument(pageUrl, Date.now() + 8000)
      expect(observed).toMatchObject({ status: 200, complete: true })
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistControlledNativeSource(source.id, runSecurityHeaderChecks(observed.finalUrl, observed.headers).map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'security-headers-missing': 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'security-headers-missing' } })
      expect(flag.evidenceTargets).toHaveLength(4)
      for (const mode of ['partial', 'partial-unknown', 'unknown', 'challenge', 'forbidden', 'rate-limited', 'redirected', 'healthy'] as const) {
        headerMode = mode === 'partial-unknown' || mode === 'unknown' ? 'healthy' : mode
        headerPolicyOverrides = mode === 'partial-unknown' || mode === 'unknown'
          ? { 'strict-transport-security': 'max-age=31536000invalid', ...(mode === 'partial-unknown' ? { 'x-content-type-options': '' } : {}) } : null
        const fixed = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'headers-fix:' + mode, changeSummary: 'Restore the recorded response header configuration' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'headers-verify:' + mode,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: fixed.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const expected = mode === 'partial' || mode === 'partial-unknown' ? 'UNCHANGED' : mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: expected,
          comparable: expected !== 'INCONCLUSIVE', verificationAuditId: run.auditId })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: mode === 'healthy' ? 'FIXED' : 'OPEN' })
        if (mode === 'partial') expect(await prisma.flag.findMany({ where: { auditId: run.auditId! }, select: { checkId: true } })).toEqual([{ checkId: 'security-hsts-too-short' }])
        if (mode === 'partial-unknown') {
          const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'check:security-headers-missing' } })
          expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'failed', source: 'http', assertion: { complete: true, passed: false,
            observed: expect.stringContaining('1 of 4 original comparisons remain unavailable.') } })
          const observation = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'module:security-headers' } })
          expect(checkReceiptSchema.parse(observation.detail)).toMatchObject({ complete: false })
        }
        if (mode === 'unknown') expect(await prisma.auditVerifierExecution.count({ where: { auditId: run.auditId!, targetKey: 'check:security-headers-missing' } })).toBe(0)
        if (mode === 'healthy') {
          const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'check:security-headers-missing' } })
          expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', assertion: { complete: true, passed: true } })
        }
      }
    } finally { headerMode = 'failed'; headerPolicyOverrides = null; transport.mockRestore() }
  }, 45_000)

  it('verifies effective CSP script and framing repairs and preserves their scheduled recurrence', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/headers'
    const owner = userId + '-csp', siteId = projectId + '-csp'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'CSP fixture', canonicalHost: 'example.com', url: pageUrl } })
    const bad = "script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none'; frame-ancestors *"
    const good = bad + ", script-src 'self'; object-src 'none'; frame-ancestors 'self'"
    const ids = ['security-csp-unsafe-inline', 'security-csp-unsafe-eval', 'security-csp-frame-ancestors-permissive']
    const complete = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['browser', 'captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      headerMode = 'healthy'; headerPolicyOverrides = { 'content-security-policy': bad }
      const document = await collectDocument(pageUrl, Date.now() + 10_000)
      const detected = runSecurityHeaderChecks(pageUrl, document.headers)
      expect(detected.map(flag => flag.checkId).sort()).toEqual([...ids].sort())
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
        executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: Object.fromEntries(ids.map(id => [id, 1])), outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, detected.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flags = await prisma.flag.findMany({ where: { auditId: source.id } })
      for (const phase of ['unchanged', 'repaired'] as const) {
        headerPolicyOverrides = { 'content-security-policy': phase === 'unchanged' ? bad : good }
        for (const flag of flags) {
          const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'csp-fix:' + phase + ':' + flag.checkId,
            changeSummary: 'Restrict the original effective CSP permission' })
          const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id, attemptId: fix.attemptId,
            idempotencyKey: 'csp-verify:' + phase + ':' + flag.checkId })
          if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('CSP verification was not admitted')
          await complete(admitted.verificationAuditId!)
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: phase === 'repaired' ? 'IMPROVED' : 'UNCHANGED', comparable: true })
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'repaired' ? 'FIXED' : 'OPEN' })
          const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: admitted.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
          expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
        }
      }
      headerPolicyOverrides = { 'content-security-policy': bad }
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(watch.auditId!, true)
      for (const flag of flags) {
        const recurring = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
        expect(recurring).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
        const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
        expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } })).toMatchObject({ improvementId: original.improvementId })
      }
    } finally { headerMode = 'failed'; headerPolicyOverrides = null; transport.mockRestore() }
  }, 120_000)

  it.each([
    { checkId: 'security-content-type-options-missing', header: 'x-content-type-options',
      broken: 'nosniff-disabled', uncorrected: 'other, nosniff', repaired: 'nosniff, other', uncertain: false },
    { checkId: 'security-referrer-policy-weak', header: 'referrer-policy',
      broken: 'no-referrer, no-referrer-when-downgrade', uncorrected: 'unrecognized', repaired: 'unsafe-url, strict-origin-when-cross-origin', uncertain: true },
    { checkId: 'security-hsts-too-short', header: 'strict-transport-security',
      broken: 'max-age=60; includeSubDomains; preload', uncorrected: 'max-age=31536000invalid; includeSubDomains; preload',
      repaired: 'max-age="31536000"; includeSubDomains; preload', uncertain: true },
    { checkId: 'security-hsts-no-subdomains', header: 'strict-transport-security',
      broken: 'max-age=31536000; no-includeSubDomains; preload', uncorrected: 'max-age=31536000invalid; includeSubDomains; preload',
      repaired: 'max-age=31536000; includeSubDomains; preload', uncertain: true },
    { checkId: 'security-hsts-no-preload', header: 'strict-transport-security',
      broken: 'max-age=31536000; includeSubDomains; note="preload"', uncorrected: 'max-age=31536000; includeSubDomains; preload; preload',
      repaired: 'max-age=31536000; includeSubDomains; preload', uncertain: true },
    { checkId: 'security-permissions-policy-overbroad', header: 'permissions-policy',
      broken: 'camera=(*)', uncorrected: 'camera = *', repaired: 'camera=*, camera=(), microphone=(), geolocation=()', uncertain: true },
    { checkId: 'security-coop-missing', header: 'cross-origin-opener-policy', broken: '', uncorrected: '"same-origin"',
      permissive: 'unsafe-none', repaired: 'same-origin;report-to="reports"', uncertain: true },
    { checkId: 'security-coep-missing', header: 'cross-origin-embedder-policy', broken: '', uncorrected: 'require-corp, require-corp',
      permissive: 'unsafe-none', repaired: 'credentialless;report-to="reports"', uncertain: true },
    { checkId: 'security-corp-missing', header: 'cross-origin-resource-policy', broken: '', uncorrected: 'SAME-ORIGIN',
      permissive: 'cross-origin', repaired: 'same-origin', uncertain: true },
  ])('verifies response policy $checkId through the worker and preserves recurrence', async scenario => {
    const transport = fixtureTransport(), pageUrl = origin + '/headers'
    const owner = userId + '-' + scenario.checkId, siteId = projectId + '-' + scenario.checkId
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Response policy fixture', canonicalHost: 'example.com', url: pageUrl } })
    const complete = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['browser', 'captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      headerMode = 'healthy'; headerPolicyOverrides = { [scenario.header]: scenario.broken }
      const document = await collectDocument(pageUrl, Date.now() + 10_000)
      const detected = runSecurityHeaderChecks(pageUrl, document.headers)
      expect(detected.map(flag => flag.checkId)).toEqual([scenario.checkId])
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { [scenario.checkId]: 1 }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, detected.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: scenario.checkId } })
      for (const phase of ['unchanged', 'uncorrected', ...('permissive' in scenario ? ['permissive' as const] : []), 'repaired'] as const) {
        headerPolicyOverrides = { [scenario.header]: phase === 'unchanged' ? scenario.broken : phase === 'uncorrected' ? scenario.uncorrected
          : phase === 'permissive' && 'permissive' in scenario ? scenario.permissive : scenario.repaired }
        const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'response-policy-fix:' + phase,
          changeSummary: 'Correct the response policy declaration' })
        const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id, attemptId: fix.attemptId,
          idempotencyKey: 'response-policy-verify:' + phase })
        if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Response policy verification was not admitted')
        await complete(admitted.verificationAuditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: phase === 'repaired' ? 'IMPROVED' : phase === 'permissive' || phase === 'uncorrected' && scenario.uncertain ? 'INCONCLUSIVE' : 'UNCHANGED',
          comparable: phase !== 'permissive' && (phase !== 'uncorrected' || !scenario.uncertain) })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'repaired' ? 'FIXED' : 'OPEN' })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: admitted.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
      }
      headerPolicyOverrides = { [scenario.header]: scenario.broken }
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(watch.auditId!, true)
      const recurring = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
      expect(recurring).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally { headerMode = 'failed'; headerPolicyOverrides = null; transport.mockRestore() }
  }, 120_000)

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

  it('keeps availability access restrictions inconclusive across incidents, repairs, history and recurrence', async () => {
    const transport = fixtureTransport()
    try {
      await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      const checks: Array<{ auditId: string; status: number; runId: string }> = []
      let originalFlagId = '', originalImprovementId = '', attemptId = ''
      for (const [index, status] of [503, 401, 403, 429, 200, 503].entries()) {
        availabilityStatus = status
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH',
          idempotencyKey: 'availability-access:' + index })
        const auditId = run.auditId!
        checks.push({ auditId, status, runId: run.runId })
        await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: auditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 15_000, interval: 100 })
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: run.runId, outcomeId: outcome.id } } })
        const restricted = [401, 403, 429].includes(status)
        expect(await probeUptime(origin + '/')).toMatchObject({
          result: restricted ? 'UNKNOWN' : status === 200 ? 'ONLINE' : 'FAILED', statusCode: status,
        })
        expect(assessment.state).toBe(restricted ? 'COULD_NOT_VERIFY' : status === 200 ? 'CLEAR' : 'FLAG')
        expect(await getOwnedRun(userId, run.runId)).toMatchObject({ result: restricted ? 'COULD_NOT_VERIFY' : status === 200 ? 'CLEAR' : 'FLAG' })
        if (index === 0) {
          const flag = await prisma.flag.findFirstOrThrow({ where: { auditId, checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
          originalFlagId = flag.id; originalImprovementId = flag.improvementOccurrence!.improvementId
          attemptId = (await recordSiteFlagFix({ siteId: projectId, userId, flagId: flag.id,
            idempotencyKey: 'availability-access-fix', changeSummary: 'Restore the public page response' })).attemptId
        }
        if (restricted) {
          expect(await prisma.flag.count({ where: { auditId, checkId: 'outcome-availability-failed' } })).toBe(0)
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: originalFlagId } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).not.toMatchObject({ outcome: 'IMPROVED' })
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ watchRegressionCount: 0, watchRecoveryCount: 0 })
          expect(await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId, outcomeId: outcome.id } })).toMatchObject({
            disposition: 'BLOCKED', reason: 'access_restricted', detail: expect.objectContaining({ status, source: 'public-http' }) })
        }
        if (status === 200) {
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: originalFlagId } })).toMatchObject({ status: 'FIXED', resolvedInId: auditId })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: auditId })
        }
        if (index === 5) {
          const flag = await prisma.flag.findFirstOrThrow({ where: { auditId, checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
          expect(flag.status).toBe('REGRESSED')
          expect(flag.improvementOccurrence?.improvementId).toBe(originalImprovementId)
        }
      }
      const history = await loadMonitoringHistory((await loadSiteRecord(projectId))!)
      for (const check of checks.filter(check => [401, 403, 429].includes(check.status)))
        expect(history.timeline.find(entry => entry.id === check.auditId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    } finally { availabilityStatus = 200; transport.mockRestore() }
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
      await persistControlledNativeSource(source.id, checkFormValidation(probe.evidence).flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'flow-form-no-validation': 1 })
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

  it('independently verifies validation on associated form controls through the worker', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/public-form', token = randomUUID()
    publicFormExternal = true
    publicFormMode = 'broken'
    await getAuditTaskQueue('browser').resume()
    try {
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 10_000,
      })
      let evidence
      try {
        evidence = (await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 4000 })).evidence
        expect(evidence).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
      } finally { session.disposeNetwork(); await session.page.context().close() }
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistControlledNativeSource(source.id, checkFormValidation(evidence).flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'flow-form-no-validation': 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'flow-form-no-validation' } })
      for (const mode of ['broken', 'healthy'] as const) {
        publicFormMode = mode
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'associated-form-fix:' + mode, changeSummary: 'Restore feedback on the original form-associated controls' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'associated-form-verify:' + mode, verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!,
            parentAuditId: source.id, attemptId: fix.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: mode === 'broken' ? 'UNCHANGED' : 'IMPROVED', comparable: true, verificationAuditId: run.auditId })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: mode === 'broken' ? 'OPEN' : 'FIXED' })
        expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'module:form-validation' } }))
          .toMatchObject({ detail: { complete: mode === 'healthy', assertions: expect.arrayContaining([expect.objectContaining({ key: 'empty-form-validation',
            context: evidence!.context, passed: mode === 'healthy', complete: true })]) } })
      }
      expect(publicFormSubmissions).toBe(0)
    } finally { publicFormExternal = false; publicFormMode = 'broken'; transport.mockRestore() }
  }, 30_000)

  it('retains metadata through literal component IDs and verifies an independent repair and monitored recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/literal-identifiers'
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { url: true } })
    await prisma.project.update({ where: { id: projectId }, data: { url: pageUrl } })
    await getAuditTaskQueue('browser').resume()
    try {
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'literal-ids-source' })
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'discovery' } }))
        .toMatchObject({ workState: 'COMPLETED' }), { timeout: 20_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: source.auditId!, workKind: { in: ['google', 'pagespeed'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(source.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 60_000, interval: 100 })
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'browser' } })
      expect(browser).toMatchObject({ workState: 'COMPLETED', workAttempts: 1, workErrorCode: null })
      expect(readArtifact(browser.workResult, 'browser').data.metadata)
        .toMatchObject({ title: 'Project planning for teams', inputsWithoutLabel: 0, buttonsWithoutText: 0, linksWithoutText: 0 })
      expect(readArtifact(browser.workResult, 'browser').data.metadataFailure).toBeUndefined()
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'no-privacy-policy' } })
      literalIdsRepaired = true
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'literal-ids-fix', changeSummary: 'Publish the missing privacy policy link' })
      const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC', idempotencyKey: 'literal-ids-verify',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.auditId!, attemptId: fix.attemptId } })
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: verified.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 30_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
      literalIdsRepaired = false
      const tick = new Date(Date.now() + 8 * 86400_000)
      await pauseExternalQueues()
      const watch = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: watch.auditId!, workKind: 'discovery' } }))
        .toMatchObject({ workState: 'COMPLETED' }), { timeout: 20_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: watch.auditId!, workKind: { in: ['google', 'pagespeed'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(watch.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 200 })
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId! } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
        .toMatchObject({ improvementId: original.improvementId })
    } finally {
      literalIdsRepaired = false
      await prisma.project.update({ where: { id: projectId }, data: { url: project.url } })
      await resumeExternalQueues(); transport.mockRestore()
    }
  }, 150_000)

  it('records associated form field counts through the worker without claiming conversion recovery', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/field-inventory'
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { url: true } })
    await prisma.project.update({ where: { id: projectId }, data: { url: pageUrl } })
    await getAuditTaskQueue('browser').resume()
    try {
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, deadline: Date.now() + 10_000,
      })
      let checked
      try {
        const metadata = parseMetadataFromHtml(await session.page.content(), pageUrl, 'rendered')
        expect(metadata).toMatchObject({ totalFormInputs: 7, maxConversionFormInputs: 7 })
        checked = await runAllChecks(pageUrl, metadata, null, null, [], undefined, undefined, undefined, undefined, true,
          ['conversion-friction'], { renderedScope: auditPageObservation(session.page)!.scope })
      } finally { session.disposeNetwork(); await session.page.context().close() }
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistControlledNativeSource(source.id, checked.flags.filter(flag => flag.checkId === 'friction-form-too-many-fields')
        .map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'friction-form-too-many-fields': CHECK_REGISTRY['friction-form-too-many-fields'].version })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'friction-form-too-many-fields' } })
      for (const phase of ['unchanged', 'healthy'] as const) {
        formInventoryCount = phase === 'healthy' ? 5 : 7
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'form-inventory-fix:' + phase,
          changeSummary: 'Keep only the project details needed for signup' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'form-inventory-verify:' + phase, verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!,
            parentAuditId: source.id, attemptId: fix.attemptId } })
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 30_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
          .toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        const observed = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'module:conversion-friction' } })
        expect(checkReceiptSchema.parse(observed.detail).assertions.find(assertion => assertion.key === 'conversion-field-count'))
          .toMatchObject({ complete: true, passed: phase === 'healthy', disposition: 'observed' })
        const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, workKind: 'browser' } })
        expect(readArtifact(browser.workResult, 'browser').data.metadata)
          .toMatchObject({ totalFormInputs: formInventoryCount, maxConversionFormInputs: formInventoryCount })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      formInventoryCount = 7
      const tick = new Date(Date.now() + 8 * 86400_000)
      const watch = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: watch.auditId!, workKind: 'discovery' } }))
        .toMatchObject({ workState: 'COMPLETED' }), { timeout: 20_000, interval: 100 })
      // This fixture has no provider credentials. Preserve their incomplete
      // coverage while allowing independent native observations to finalize.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: watch.auditId!, workKind: { in: ['google', 'pagespeed'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(watch.auditId!))
      await resumeExternalQueues()
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 200 })
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId! } })
      expect(recurrence).toMatchObject({ status: 'OPEN', fingerprint: flag.fingerprint })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally {
      formInventoryCount = 7
      await prisma.project.update({ where: { id: projectId }, data: { url: project.url } })
      await resumeExternalQueues()
      transport.mockRestore()
    }
  }, 150_000)

  it('records browser loading clearance independently of delayed metadata and nonblocking loading UI', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/loading-observation'
    try {
      for (const clearMs of [1000, 5200, null]) {
        loadingUiClearMs = clearMs
        const measured = await captureScreenshots(pageUrl, 'loading-observation-' + suffix, undefined,
          { runFlow: false, captureMedia: false, deadline: Date.now() + 40_000 })
        expect(measured.captureFailures).toEqual([])
        expect(measured.captureMetrics).not.toBeNull()
        const windows = [measured.loadExperience!, measured.captureMetrics!.desktopLoadExperience!]
        for (const window of windows) {
          expect(window.loadingVisibleAtInitial).toBe(true)
          expect(window.loadingVisibleAtFinal).toBe(clearMs === null)
          if (clearMs === null) expect(window.loadingClearedMs).toBeNull()
          else {
            expect(window.loadingClearedMs).toBeGreaterThanOrEqual(clearMs)
            expect(window.loadingClearedMs!).toBeLessThan(clearMs + 1200)
          }
        }
        const interaction = runInteractionChecks(measured.captureMetrics)
        const mobile = runMobileUXQualityChecks(measured.captureMetrics)
        expect(interaction.map(flag => flag.checkId)).toEqual(clearMs === null ? ['loading-indicator-stuck'] : clearMs > 3000 ? ['loading-state-slow'] : [])
        expect(mobile.filter(flag => flag.checkId === 'mobile-load-delay-content')).toHaveLength(clearMs !== null && clearMs > 4000 ? 1 : 0)
      }
    } finally { loadingUiClearMs = 1000; transport.mockRestore() }
  }, 90_000)

  it('requires completed activation to verify an overlay observed after a failed click', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    const owner = 'after-overlay-owner-' + suffix, siteId = 'after-overlay-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'After-action overlay fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      overlayMode = 'covered'
      const blocked = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true })
      let original
      try {
        await expect(blocked.page.locator('#original-action').click({ timeout: 500 })).rejects.toThrow()
        const recorded = createOverlayInteractionRecorder(blocked.page)
        original = await recorded.inspect('#original-action', 'cta', 'primary_action_after')
        expect(original.observation?.controls[0].disposition).toBe('failed')
      } finally { blocked.disposeNetwork(); await blocked.page.context().close() }
      overlayMode = 'healthy'
      const current = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true })
      try {
        const target = original!.observation!.controls[0]
        const recorder = createOverlayInteractionRecorder(current.page, { expectedTargets: [{ kind: target.kind, selector: target.selector, label: target.label, context: target.context }] })
        const clear = await recorder.inspect('#original-action', 'cta', 'primary_action_after')
        expect(clear.observation?.controls[0].disposition).toBe('unknown')
        const before = await recorder.inspect('#original-action', 'cta', 'primary_action')
        await current.page.locator('#original-action').click({ timeout: 3000 })
        recorder.activated(before)
        expect(recorder.observations().find(observation => observation.phase === 'primary_action_after')?.controls[0].disposition).toBe('passed')
      } finally { current.disposeNetwork(); await current.page.context().close() }
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED', isPublic: false,
        startedAt: new Date(), completedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { 'overlay-blocks-cta': 1 }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, runObservedOverlayChecks(original!.observation!), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'overlay-blocks-cta' } })
      for (const mode of ['blank', 'healthy'] as const) {
        overlayMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'after-overlay-fix:' + mode,
          changeSummary: 'Restore activation of the originally covered control' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'after-overlay-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('After-action overlay verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 25_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({
          outcome: mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE', comparable: mode === 'healthy' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: mode === 'healthy' ? 'FIXED' : 'OPEN' })
      }
    } finally { overlayMode = 'covered'; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 90_000)

  it('independently verifies the original mobile navigation links through the worker and recognizes recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/mobile-navigation'
    const owner = 'mobile-nav-owner-' + suffix, siteId = 'mobile-nav-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Mobile navigation fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); mobileNavigationMode = 'missing'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'flow-mobile-menu-broken': 1 }, outcomes: [], verificationTarget: null } } })
      const session = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: MOBILE_CAPTURE_PROFILE, journeySafe: true })
      let flags
      try {
        const observed = await collectMobileNavigation(session.page, Date.now() + 8000)
        flags = mobileNavigationFlags(observed.observations, pageUrl)
      } finally { session.disposeNetwork(); await session.page.context().close() }
      expect(flags).toHaveLength(1)
      await persistControlledNativeSource(source.id, flags!, {})
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'flow-mobile-menu-broken' } })
      expect(flag.verificationRule).toBe(MOBILE_NAVIGATION_RULE)
      for (const mode of ['missing', 'noop', 'removed', 'changed', 'blank', 'challenge', 'healthy'] as const) {
        mobileNavigationMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'mobile-navigation-fix:' + mode,
          changeSummary: 'Restore the original mobile navigation' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'mobile-navigation-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Mobile navigation verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 25_000, interval: 100 })
        const comparable = ['missing', 'noop', 'healthy'].includes(mode)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({
          outcome: mode === 'healthy' ? 'IMPROVED' : comparable ? 'UNCHANGED' : 'INCONCLUSIVE', comparable })
        expect(await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.verificationAuditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true, workInput: true } }), mode)
          .toEqual(expect.arrayContaining([expect.objectContaining({ workKind: 'flow', workInput: expect.objectContaining({ module: 'mobile-navigation' }) })]))
        expect(await prisma.auditVerifierExecution.count({ where: { auditId: verified.verificationAuditId!, workKind: { in: ['browser', 'pagespeed', 'google', 'journeys'] } } }), mode).toBe(0)
        if (mode === 'healthy') expect(await getOwnedRun(owner, verified.runId)).toMatchObject({ result: 'CLEAR' })
        else expect((await getOwnedRun(owner, verified.runId))?.result, mode).not.toBe('CLEAR')
        if (mode === 'challenge') expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.verificationAuditId!, targetKey: 'module:mobile-navigation' } })).toMatchObject({ status: 'FAILED' })
      }
      mobileNavigationMode = 'missing'; await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'mobile-navigation-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 25_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 55_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: flag.checkId }, include: { improvementOccurrence: true } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: original.improvementId, kind: 'REGRESSED' } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: expect.any(String) })
    } finally { mobileNavigationMode = 'missing'; await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore() }
  }, 180_000)

  it('verifies the collapsed missing-action Flag across its original journey types through the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/journey-entry'
    const owner = 'journey-action-owner-' + suffix, siteId = 'journey-action-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Shared journey action fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume(); journeyMode = 'missing'; journeyCtaMode = 'missing'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'journey-hidden-cta': 1 }, outcomes: [], verificationTarget: null } } })
      const findings = []
      for (const journeyType of ['first-visit', 'pricing-evaluation', 'signup'] as const) {
        const observed = await runJourneyTemplate(await getAuditBrowser(), { auditId: source.id, startUrl: pageUrl, journeyType,
          journeyPageOnly: true, expectedJourneyRoute: [], deadlineMs: Date.now() + 15_000 })
        findings.push(...observed.findings)
      }
      await persistControlledNativeSource(source.id, nativeJourneyFlags(findings), {})
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'journey-hidden-cta' } })
      expect(flag.evidenceTargets).toHaveLength(3)
      for (const mode of ['hidden', 'visible'] as const) {
        journeyCtaMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'journey-action-fix:' + mode, changeSummary: 'Show the primary action' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'journey-action-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Shared journey Flag verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 35_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({ outcome: mode === 'visible' ? 'IMPROVED' : 'UNCHANGED', comparable: true })
        expect(await getOwnedRun(owner, verified.runId)).toMatchObject({ result: mode === 'visible' ? 'CLEAR' : 'FLAG' })
      }
    } finally { journeyCtaMode = 'visible'; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 100_000)

  it('verifies signup page conditions on the original journey through the worker and preserves recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/journey-entry'
    const owner = 'journey-condition-owner-' + suffix, siteId = 'journey-condition-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Public signup page fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      journeyMode = 'missing'; journeySubmissions = 0
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'journey-signup-no-form': 1 }, outcomes: [], verificationTarget: null } } })
      const observed = await runJourneyTemplate(await getAuditBrowser(), { auditId: source.id, startUrl: pageUrl, journeyType: 'signup', deadlineMs: Date.now() + 20_000 })
      expect(observed.findings.find(finding => finding.checkId === 'journey-signup-no-form')).toMatchObject({ verificationRule: JOURNEY_VERIFICATION_RULE, affectedPaths: [pageUrl] })
      await persistJourneyResult(source.id, observed, undefined, ['journey-signup-no-form'])
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'journey-signup-no-form' } })
      expect(flag).toMatchObject({ source: 'JOURNEY', pageUrl })
      for (const mode of ['missing', 'hidden', 'reranked', 'disabled', 'changed', 'blank', 'challenge', 'healthy'] as const) {
        journeyMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'journey-condition-fix:' + mode,
          changeSummary: 'Restore visible fields on the original signup route' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'journey-condition-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Journey condition verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 35_000, interval: 100 }).catch(async error => {
          const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.verificationAuditId!, targetKey: { startsWith: 'task:' } },
            select: { targetKey: true, workState: true, workErrorCode: true } })
          throw new Error(JSON.stringify({ mode, tasks }), { cause: error })
        })
        const comparable = ['missing', 'hidden', 'reranked', 'healthy'].includes(mode)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({
          outcome: mode === 'healthy' ? 'IMPROVED' : comparable ? 'UNCHANGED' : 'INCONCLUSIVE', comparable })
        expect(await prisma.auditVerifierExecution.count({ where: { auditId: verified.verificationAuditId!, workKind: 'journeys', workState: 'COMPLETED' } })).toBe(1)
        if (mode === 'healthy') expect(await getOwnedRun(owner, verified.runId)).toMatchObject({ result: 'CLEAR' })
        else expect((await getOwnedRun(owner, verified.runId))?.result, mode).not.toBe('CLEAR')
        if (mode === 'blank' || mode === 'challenge') expect(await prisma.flag.count({ where: { auditId: verified.verificationAuditId!, checkId: 'journey-signup-no-form' } }), mode).toBe(0)
        expect(journeySubmissions, mode).toBe(0)
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: expect.any(String) })
      journeyMode = 'missing'
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'journey-condition-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 25_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 55_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: flag.checkId }, include: { improvementOccurrence: true } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', pageUrl, improvementOccurrence: { improvementId: original.improvementId, kind: 'REGRESSED' } })
      expect(await prisma.journeyFinding.count({ where: { journeyReview: { auditId: recurrence.auditId! }, checkId: flag.checkId, flagId: repeated.id } })).toBeGreaterThan(0)
    } finally { journeyMode = 'missing'; await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore() }
  }, 300_000)

  it('independently replays a recorded journey overlay even when current page classification changes', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    const owner = 'journey-overlay-owner-' + suffix, siteId = 'journey-overlay-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Journey overlay fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      await getAuditTaskQueue('browser').resume()
      overlayMode = 'hover-primary'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'overlay-blocks-nav': 1 }, outcomes: [], verificationTarget: null } } })
      const observed = await runJourneyTemplate(await getAuditBrowser(), { auditId: source.id, startUrl: pageUrl, journeyType: 'signup', deadlineMs: Date.now() + 20_000 })
      expect(observed.findings.some(finding => finding.checkId === 'overlay-blocks-nav' && finding.verificationRule === OVERLAY_VERIFICATION_RULE)).toBe(true)
      await persistJourneyResult(source.id, observed, undefined, ['overlay-blocks-nav'])
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'overlay-blocks-nav' } })
      expect(flag.source).toBe('JOURNEY')
      for (const mode of ['hover-primary', 'blank', 'healthy'] as const) {
        overlayMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'journey-overlay-fix:' + mode,
          changeSummary: 'Restore the originally blocked signup entry' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'journey-overlay-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Journey overlay verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 100 })
        const expected = mode === 'healthy' ? 'IMPROVED' : mode === 'blank' ? 'INCONCLUSIVE' : 'UNCHANGED'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({ outcome: expected, comparable: mode !== 'blank' })
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: verified.verificationAuditId! } })
        expect(readExecutionSpec(audit.executionSpec)?.verificationScopes?.some(scope => scope.overlayPhases?.includes('journey_signup_nav'))).toBe(true)
        expect(await prisma.auditVerifierExecution.count({ where: { auditId: audit.id, workKind: 'journeys', workState: 'COMPLETED' } })).toBe(1)
        if (mode === 'healthy') expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.verificationAuditId })
      }
    } finally { overlayMode = 'covered'; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 120_000)

  it('verifies original interaction overlay flags through the worker and preserves monitoring recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    const owner = 'interaction-overlay-owner-' + suffix, siteId = 'interaction-overlay-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Interaction overlay fixture', url: pageUrl, canonicalHost: 'example.com' } })
    const originals: Array<Awaited<ReturnType<typeof prisma.flag.findFirstOrThrow>>> = []
    try {
      await getAuditTaskQueue('browser').resume()
      for (const mode of ['hover-primary', 'hover-navigation', 'hover-form'] as const) {
        overlayMode = mode
        const checkId = mode === 'hover-primary' ? 'overlay-blocks-cta' : mode === 'hover-navigation' ? 'overlay-blocks-nav' : 'overlay-blocks-form'
        const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
          startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
            checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null } } })
        const session = await createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true })
        let observed
        try {
          if (mode === 'hover-form') {
            const result = await probeFormValidation(session.page)
            observed = scopedOverlayResult('form', result.formOverlay, result.formLabel, result.formOverlayObservation)
          } else observed = runFlowChecks(await runFlowScan(session.page, source.id, pageUrl,
            { captureSteps: false, mode: mode === 'hover-primary' ? 'primary' : undefined, includeFormValidation: false }))
        } finally { session.disposeNetwork(); await session.page.context().close() }
        await persistControlledNativeSource(source.id, observed!.filter(flag => flag.checkId === checkId), { MESSAGE: null, EXPERIENCE: null, REACH: null })
        await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
        await materializeAttentionForAudit(source.id)
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId } })
        originals.push(flag)
        for (const phase of ['unchanged', 'blank', 'healthy'] as const) {
          overlayMode = phase === 'unchanged' ? mode : phase
          const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'interaction-overlay-fix:' + checkId + ':' + phase,
            changeSummary: 'Remove the cover that appears during the originally recorded interaction' })
          const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
            idempotencyKey: 'interaction-overlay-check:' + checkId + ':' + phase, source: 'MCP' })
          if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Interaction overlay verification was not admitted')
          await vi.waitFor(async () => {
            expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
          }, { timeout: 25_000, interval: 100 })
          const audit = await prisma.audit.findUniqueOrThrow({ where: { id: verified.verificationAuditId! } })
          const spec = readExecutionSpec(audit.executionSpec)!
          expect(spec.verificationScopes?.some(scope => scope.overlayPhases?.length), mode + ':' + phase).toBe(true)
          expect(await prisma.auditVerifierExecution.count({ where: { auditId: audit.id, workKind: { in: ['google', 'pagespeed', 'overlays'] } } })).toBe(0)
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode + ':' + phase).toMatchObject({
            outcome: phase === 'healthy' ? 'IMPROVED' : phase === 'blank' ? 'INCONCLUSIVE' : 'UNCHANGED', comparable: phase !== 'blank' })
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'healthy' ? 'FIXED' : 'OPEN' })
          if (phase === 'healthy') expect(await getOwnedRun(owner, verified.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
        }
      }
      overlayMode = 'covered'
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'interaction-overlay-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 25_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 45_000, interval: 100 })
      for (const original of originals) {
        const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: original.checkId }, include: { improvementOccurrence: true } })
        const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: original.id } })
        expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: occurrence.improvementId, kind: 'REGRESSED' } })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'FIXED', resolvedInId: expect.any(String) })
        if (original.checkId === 'overlay-blocks-nav') {
          const contexts = Array.isArray(repeated.evidenceTargets) ? repeated.evidenceTargets.map(value => value && typeof value === 'object' && !Array.isArray(value) ? value.context : null) : []
          expect(contexts.some(context => typeof context === 'string' && context.includes(':page_load:nav:'))).toBe(true)
          expect(contexts.some(context => typeof context === 'string' && context.includes(':pricing_navigation:nav:'))).toBe(true)
          expect(contexts.some(context => typeof context === 'string' && context.includes(':journey_'))).toBe(true)
          expect(await prisma.journeyFinding.count({ where: { journeyReview: { auditId: recurrence.auditId! }, checkId: original.checkId, flagId: repeated.id } })).toBeGreaterThan(0)
        }
      }
    } finally { overlayMode = 'covered'; await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore() }
  }, 180_000)

  it('records covers that appear during original hover and form phases and independently rechecks the same condition', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    try {
      const browser = await getAuditBrowser()
      for (const mode of ['hover-primary', 'hover-navigation', 'hover-form'] as const) {
        overlayMode = mode
        expect(runObservedOverlayChecks(await collectOverlayObservation(browser, pageUrl, { device: 'desktop', deadline: Date.now() + 15_000 }))).toEqual([])
        const session = await createAuditPage(browser, pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true })
        let flags
        const started = Date.now()
        try {
          if (mode === 'hover-form') {
            const result = await probeFormValidation(session.page)
            flags = scopedOverlayResult('form', result.formOverlay, result.formLabel, result.formOverlayObservation)
          } else flags = runFlowChecks(await runFlowScan(session.page, 'overlay-phase-' + suffix, pageUrl,
            { captureSteps: false, mode: mode === 'hover-primary' ? 'primary' : undefined, includeFormValidation: false }))
        } finally { session.disposeNetwork(); await session.page.context().close() }
        const checkId = mode === 'hover-primary' ? 'overlay-blocks-cta' : mode === 'hover-navigation' ? 'overlay-blocks-nav' : 'overlay-blocks-form'
        const flag = flags!.find(flag => flag.checkId === checkId)!
        expect(flag, mode).toMatchObject({ verificationRule: OVERLAY_VERIFICATION_RULE })
        const phase = mode === 'hover-primary' ? 'primary_action' : mode === 'hover-navigation' ? 'pricing_navigation' : 'form_validation'
        expect(flag.evidenceTargets?.some(target => target.context?.includes(':' + phase + ':')), mode).toBe(true)
        expect(Date.now() - started, mode).toBeLessThan(7000)
        overlayMode = 'healthy'
        const current = await createAuditPage(browser, pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true })
        try {
          const expectedTargets = flag.evidenceTargets!.map(target => ({ kind: target.context!.split(':')[4] as 'nav' | 'cta' | 'form',
            selector: target.selector!, label: target.label, context: target.context! }))
          if (mode === 'hover-form') {
            const recorder = (await import('@/lib/audit/browser/overlay-interaction')).createOverlayInteractionRecorder(current.page, { expectedTargets })
            await probeFormValidation(current.page, { overlayRecorder: recorder, overlayOnly: true })
            expect(recorder.observations().filter(observation => observation.phase === phase).flatMap(overlayAssertions).every(assertion => assertion.passed && assertion.complete)).toBe(true)
          } else {
            const result = await runFlowScan(current.page, 'overlay-repair-' + suffix, pageUrl, { captureSteps: false,
              overlayOnly: true, expectedOverlayTargets: expectedTargets, mode: mode === 'hover-primary' ? 'primary' : undefined, includeFormValidation: false })
            expect(result.overlayObservations!.filter(observation => observation.phase === phase).flatMap(overlayAssertions).every(assertion => assertion.passed && assertion.complete)).toBe(true)
          }
        } finally { current.disposeNetwork(); await current.page.context().close() }
      }
    } finally { overlayMode = 'covered'; transport.mockRestore() }
  }, 90_000)

  it('observes persistent covers and original-control scope without clicking or submitting', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    try {
      const browser = await getAuditBrowser()
      for (const device of ['desktop', 'mobile'] as const) {
        overlayMode = 'covered'
        const source = await collectOverlayObservation(browser, pageUrl, { device, deadline: Date.now() + 15_000 })
        expect(source.complete, device).toBe(true)
        const flags = runObservedOverlayChecks(source)
        expect(flags.map(flag => flag.checkId).sort(), device).toEqual(['overlay-blocks-cta', 'overlay-blocks-form', 'overlay-blocks-nav'])
        expect(flags.every(flag => flag.verificationRule === OVERLAY_VERIFICATION_RULE)).toBe(true)
        const expectedTargets = source.controls.map(({ kind, selector, label, context }) => ({ kind, selector, label, context }))
        for (const mode of ['healthy', 'transient', 'consent', 'hidden', 'blank', 'challenge'] as const) {
          overlayMode = mode
          const current = await collectOverlayObservation(browser, pageUrl, { device, expectedTargets, deadline: Date.now() + 15_000 })
          expect(runObservedOverlayChecks(current), mode + ':' + device).toEqual([])
          const assertions = overlayAssertions(current)
          if (['healthy', 'transient', 'consent'].includes(mode)) expect(assertions.every(assertion => assertion.passed && assertion.complete), mode + ':' + device).toBe(true)
          else expect(assertions.some(assertion => !assertion.passed && assertion.complete === false), mode + ':' + device).toBe(true)
        }
      }
      expect(requests.filter(request => request === 'POST /overlay-observation')).toEqual([])
    } finally { overlayMode = 'covered'; transport.mockRestore() }
  }, 90_000)

  it('independently verifies the original initial overlay cohort through missing evidence, device repair and recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/overlay-observation'
    const owner = 'overlay-owner-' + suffix, siteId = 'overlay-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Overlay repair fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      overlayMode = 'covered'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'overlay-blocks-cta': 1 }, outcomes: [], verificationTarget: null } } })
      const observed = []
      for (const device of ['desktop', 'mobile'] as const) observed.push(...runObservedOverlayChecks(await collectOverlayObservation(await getAuditBrowser(), pageUrl,
        { device, deadline: Date.now() + 15_000 })).filter(flag => flag.checkId === 'overlay-blocks-cta'))
      await persistControlledNativeSource(source.id, observed, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'overlay-blocks-cta' } })
      let resolution: string | null = null
      for (const mode of ['blank', 'hidden', 'challenge', 'desktop-healthy', 'healthy'] as const) {
        overlayMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'overlay-fix:' + mode,
          changeSummary: 'Remove the persistent cover from the originally observed controls on both devices' })
        const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'overlay-check:' + mode, source: 'MCP' })
        if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Overlay repair verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verified.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        const expected = mode === 'desktop-healthy' ? 'UNCHANGED' : mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode).toMatchObject({ outcome: expected,
          comparable: mode === 'desktop-healthy' || mode === 'healthy' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }), mode).toMatchObject({ status: mode === 'healthy' ? 'FIXED' : 'OPEN' })
        if (mode === 'healthy') {
          resolution = verified.verificationAuditId!
          expect(await getOwnedRun(owner, verified.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
          expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: resolution,
            targetKey: 'check:overlay-blocks-cta' } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
        }
      }
      overlayMode = 'covered'
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'overlay-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 20_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 40_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: 'overlay-blocks-cta' }, include: { improvementOccurrence: true } })
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: occurrence.improvementId, kind: 'REGRESSED' } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: resolution })
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: recurrence.auditId!, workKind: 'overlays', workState: 'COMPLETED' } })).toBeGreaterThanOrEqual(2)
    } finally { overlayMode = 'covered'; await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore() }
  }, 120_000)

  it('observes native initial motion without duplicate, hidden or paused effects and honors startup-only preferences', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/motion-observation'
    try {
      for (const mode of ['mixed', 'paused', 'hidden', 'intro', 'script-ignored', 'script-honored', 'transition-ignored', 'transition-honored'] as const) {
        motionMode = mode
        const measured = await captureScreenshots(pageUrl, 'motion-' + mode + '-' + suffix, undefined,
          { captureMedia: false, runFlow: false, deadline: Date.now() + 20_000 })
        const data = measured.captureMetrics!
        expect(data.motionComplete, mode).toBe(true)
        const failed = ['mixed', 'intro', 'script-ignored', 'transition-ignored'].includes(mode)
        expect(data.motionIgnoresReducedPreference, mode).toBe(failed)
        const flags = runInteractionChecks(data).filter(flag => flag.checkId === 'motion-ignores-reduced-preference')
        expect(flags.length, mode).toBe(failed ? 1 : 0)
        if (failed) expect(flags[0]).toMatchObject({ verificationRule: MOTION_VERIFICATION_RULE,
          evidenceTargets: expect.arrayContaining([expect.objectContaining({ selector: '#original', source: 'measured', device: 'mobile' })]) })
        if (mode === 'mixed') expect(motionAssertions(data.motionObservation)[0].observed).toContain('3 moving elements under normal preference, 2 under reduced preference')
        if (mode === 'intro') expect(data.motionObservation!.after.targets.map(target => target.selector)).toContain('#original')
        if (mode === 'script-honored') {
          expect(data.motionObservation!.before.targets).toEqual([expect.objectContaining({ family: 'script', selector: '#original' })])
          expect(data.motionObservation!.after.targets).toEqual([])
        }
      }
    } finally { motionMode = 'ignored'; transport.mockRestore() }
  }, 90_000)

  it('verifies the original reduced-motion cohort through padding, unavailable evidence, repair and monitoring recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/motion-observation'
    const owner = 'motion-owner-' + suffix, siteId = 'motion-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Motion repair fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      motionMode = 'ignored'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
        startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'motion-ignores-reduced-preference': 1 }, outcomes: [], verificationTarget: null } } })
      const measured = await captureScreenshots(pageUrl, source.id, undefined, { captureMedia: false, runFlow: false, deadline: Date.now() + 20_000 })
      const flags = runInteractionChecks(measured.captureMetrics).filter(flag => flag.checkId === 'motion-ignores-reduced-preference')
      expect(flags).toHaveLength(1)
      await persistControlledNativeSource(source.id, flags.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'motion-ignores-reduced-preference' } })
      let resolution: string | null = null
      for (const mode of ['padding', 'blank', 'challenge', 'honored'] as const) {
        motionMode = mode
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'motion-fix:' + mode,
          changeSummary: 'Honor reduced motion on the originally observed animation' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'motion-check:' + mode, source: 'MCP' })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Motion verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: verification.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 25_000, interval: 100 })
        const expected = mode === 'padding' ? 'UNCHANGED' : mode === 'honored' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }), mode)
          .toMatchObject({ outcome: expected, comparable: mode === 'padding' || mode === 'honored' })
        if (mode === 'padding') {
          const motion = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verification.verificationAuditId!, workKind: 'motion' } })
          expect(motion.workState).toBe('COMPLETED')
          expect(motionAssertions(readArtifact(motion.workResult, 'motion').data)[0].passed).toBe(true)
        }
        if (mode === 'honored') {
          resolution = verification.verificationAuditId!
          expect(await getOwnedRun(owner, verification.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
          expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: resolution,
            targetKey: 'check:' + flag.checkId } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
        }
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }), mode).toMatchObject({ status: mode === 'honored' ? 'FIXED' : 'OPEN' })
      }
      motionMode = 'ignored'
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'motion-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 20_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 35_000, interval: 100 })
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: flag.checkId }, include: { improvementOccurrence: true } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: original.improvementId, kind: 'REGRESSED' } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: resolution })
    } finally { motionMode = 'ignored'; await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore() }
  }, 120_000)

  it('verifies loading failures, retains advisory uncertainty and reopens recovered incidents on recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/loading-observation'
    const owner = 'loading-owner-' + suffix, siteId = 'loading-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Loading repair fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      const sources: Array<Awaited<ReturnType<typeof prisma.flag.findFirstOrThrow>>> = []
      for (const clearMs of [5200, null]) {
        loadingUiClearMs = clearMs
        const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING', isPublic: false,
          startedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
            checks: { 'loading-state-slow': 1, 'loading-indicator-stuck': 1, 'mobile-load-delay-content': 2 }, outcomes: [], verificationTarget: null } } })
        const measured = await captureScreenshots(pageUrl, source.id, undefined, { captureMedia: false, runFlow: false, deadline: Date.now() + 40_000 })
        const flags = [...runInteractionChecks(measured.captureMetrics), ...runMobileUXQualityChecks(measured.captureMetrics)]
          .filter(flag => ['loading-state-slow', 'loading-indicator-stuck', 'mobile-load-delay-content'].includes(flag.checkId))
        expect(flags.map(flag => flag.checkId).sort()).toEqual(clearMs === null ? ['loading-indicator-stuck'] : ['loading-state-slow', 'mobile-load-delay-content'])
        await persistControlledNativeSource(source.id, flags.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
        await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
        await materializeAttentionForAudit(source.id)
        sources.push(...await prisma.flag.findMany({ where: { auditId: source.id } }))
      }
      const delay = sources.find(flag => flag.checkId === 'loading-state-slow')!
      async function verify(flag: typeof delay, phase: string) {
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner, idempotencyKey: 'loading-fix:' + flag.checkId + ':' + phase,
          changeSummary: 'Restore promptly visible page content under the recorded loading conditions' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
          idempotencyKey: 'loading-check:' + flag.checkId + ':' + phase, source: 'MCP' })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Loading repair verification was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      loadingUiMode = 'blank'
      expect((await verify(delay, 'blank')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: delay.id } })).toMatchObject({ status: 'OPEN' })
      loadingUiMode = 'page'; loadingUiClearMs = 5200; loadingUiDesktopMs = 1000
      expect((await verify(delay, 'partial')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      loadingUiMode = 'challenge'
      expect((await verify(delay, 'challenge')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      loadingUiMode = 'page'; loadingUiClearMs = 1000; loadingUiDesktopMs = undefined
      for (const flag of sources) {
        loadingUiMode = flag.checkId === 'loading-state-slow' ? 'page' : 'desktop-challenge'
        const verified = await verify(flag, 'healthy')
        const advisory = flag.checkId === 'mobile-load-delay-content'
        const diagnostics = verified.attempt.outcome === (advisory ? 'INCONCLUSIVE' : 'IMPROVED') ? [] : await prisma.auditVerifierExecution.findMany({
          where: { auditId: verified.run.verificationAuditId!, OR: [{ targetKey: { startsWith: 'check:' } }, { targetKey: { startsWith: 'module:' } }, { workKind: 'check' }] },
          select: { targetKey: true, detail: true, workState: true, workErrorCode: true, workResult: true },
        })
        expect(verified.attempt, JSON.stringify({ checkId: flag.checkId, originalTargets: flag.evidenceTargets, diagnostics }))
          .toMatchObject({ outcome: advisory ? 'INCONCLUSIVE' : 'IMPROVED', comparable: !advisory })
        if (advisory) {
          // A measured advisory clearance cannot certify the original incident.
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.run.verificationAuditId!, targetKey: 'check:' + flag.checkId } })).toBeNull()
          expect(await getOwnedRun(owner, verified.run.runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
          continue
        }
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.run.verificationAuditId })
        expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.run.verificationAuditId!,
          targetKey: 'check:' + flag.checkId } })).detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
        expect(await getOwnedRun(owner, verified.run.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
      }
      for (const clearMs of [5200, null]) {
        loadingUiMode = 'page'
        loadingUiClearMs = clearMs
        await pauseExternalQueues()
        const run = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'loading-recurrence:' + clearMs })
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: run.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: clearMs === null ? 25_000 : 15_000, interval: 100 }).catch(async error => {
          const pending = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, workKind: { not: null }, workState: { not: 'COMPLETED' } },
            select: { targetKey: true, workKind: true, workState: true, workErrorCode: true, workAttempts: true } })
          throw new Error('Loading recurrence discovery unfinished: ' + JSON.stringify(pending), { cause: error })
        })
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!, workKind: { in: ['google', 'pagespeed'] } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(run.auditId!)); await resumeExternalQueues()
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 35_000, interval: 100 })
        const repeated = await prisma.flag.findMany({ where: { auditId: run.auditId!, checkId: { in: sources.map(flag => flag.checkId!) } }, include: { improvementOccurrence: true } })
        expect(repeated.map(flag => flag.checkId).sort()).toEqual(clearMs === null ? ['loading-indicator-stuck'] : ['loading-state-slow', 'mobile-load-delay-content'])
        for (const flag of repeated) {
          const original = sources.find(source => source.checkId === flag.checkId)!
          const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: original.id } })
          const advisory = flag.checkId === 'mobile-load-delay-content'
          expect(flag.status).toBe(advisory ? 'OPEN' : 'REGRESSED')
          expect(flag.improvementOccurrence).toMatchObject({ improvementId: occurrence.improvementId, kind: advisory ? 'OBSERVED' : 'REGRESSED' })
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject(advisory
            ? { status: 'OPEN', resolvedInId: null } : { status: 'FIXED', resolvedInId: expect.any(String) })
        }
      }
    } finally {
      loadingUiMode = 'page'; loadingUiClearMs = 1000; loadingUiDesktopMs = undefined
      await prisma.user.delete({ where: { id: owner } }); await resumeExternalQueues(); transport.mockRestore()
    }
  }, 150_000)

  it('collects faithful slow connection timing and independently verifies text and action repairs through the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/slow-entry'
    const owner = 'slow-replay-owner-' + suffix, siteId = 'slow-replay-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Slow connection fixture', url: pageUrl, canonicalHost: 'example.com' } })
    try {
      await getAuditTaskQueue('browser').resume()
      slowReplayMode = 'delayed'
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'CAPTURING',
        isPublic: false, startedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: {
          version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
          checks: { 'slow-3g-blank-screen': 1, 'slow-3g-cta-delayed': 1 }, outcomes: [], verificationTarget: null,
        } } })
      const observation = await runSlowReplay(await getAuditBrowser(), source.id, pageUrl, { deadline: Date.now() + 20_000, pageKey: 'source' })
      await prisma.audit.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      expect(observation).toMatchObject({ navigationComplete: true, complete: true })
      expect(observation.scope).toMatchObject({ pageUrl, finalUrl: origin + '/slow-visibility', access: 'public' })
      expect(observation.captures?.map(capture => capture.targetMs)).toEqual([2000, 5000, 8000])
      expect(observation.captures?.every(capture => capture.startedAtMs >= capture.targetMs && capture.startedAtMs < capture.targetMs + 2000)).toBe(true)
      const findings = runSlowReplayChecks(observation)
      expect(findings.map(flag => flag.checkId).sort()).toEqual(['slow-3g-blank-screen', 'slow-3g-cta-delayed'])
      await persistControlledNativeSource(source.id, findings.map(flag => ({ ...flag, pageUrl })), { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flags = await prisma.flag.findMany({ where: { auditId: source.id }, include: { improvementOccurrence: true } })
      slowReplayMode = 'challenge'
      const attempted = await recordSiteFlagFix({ siteId, flagId: flags[0].id, userId: owner,
        idempotencyKey: 'slow-replay-gap-fix', changeSummary: 'Restore timely mobile content' })
      const gap = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flags[0].id, userId: owner,
        attemptId: attempted.attemptId, idempotencyKey: 'slow-replay-gap-check', source: 'MCP' })
      if (!gap.ok || !('verificationAuditId' in gap)) throw new Error('Slow visibility gap check was not admitted')
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: gap.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempted.attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flags[0].id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: gap.verificationAuditId!, targetKey: 'module:slow-replay' } }))
        .toMatchObject({ status: 'FAILED', detail: expect.objectContaining({ module: 'slow-replay', failed: true, passed: false }) })
      slowReplayMode = 'healthy'
      await persistProjectScanAccess(siteId, owner, { headers: { 'X-Slow-Fixture': 'PRIVATE_SLOW_ACCESS' } })
      for (const flag of flags) {
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner,
          idempotencyKey: 'slow-replay-access-fix:' + flag.checkId, changeSummary: 'Check the original mobile page conditions' })
        const changed = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner,
          attemptId: fix.attemptId, idempotencyKey: 'slow-replay-access-check:' + flag.checkId, source: 'MCP' })
        if (!changed.ok || !('verificationAuditId' in changed)) throw new Error('Slow visibility access check was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: changed.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
        const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: changed.verificationAuditId!, workKind: 'slow-replay' } })
        expect(readArtifact(task.workResult, 'slow-replay').data.result).toMatchObject({ scope: { access: expect.stringMatching(/^credentialed:[a-f0-9]{64}$/) } })
        expect(JSON.stringify(task.workResult)).not.toContain('PRIVATE_SLOW_ACCESS')
      }
      await persistProjectScanAccess(siteId, owner, null)
      slowReplayMode = 'competing'
      const action = flags.find(flag => flag.checkId === 'slow-3g-cta-delayed')!
      const competingFix = await recordSiteFlagFix({ siteId, flagId: action.id, userId: owner,
        idempotencyKey: 'slow-replay-competing-fix', changeSummary: 'Check the original delayed action' })
      const competing = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: action.id, userId: owner,
        attemptId: competingFix.attemptId, idempotencyKey: 'slow-replay-competing-check', source: 'MCP' })
      if (!competing.ok || !('verificationAuditId' in competing)) throw new Error('Original action comparison was not admitted')
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: competing.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: competingFix.attemptId } })).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      const competingFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: competing.verificationAuditId!, checkId: action.checkId } })
      slowReplayMode = 'healthy'
      for (const flag of flags) {
        const fix = await recordSiteFlagFix({ siteId, flagId: flag.id, userId: owner,
          idempotencyKey: 'slow-replay-fix:' + flag.checkId, changeSummary: 'Render the original mobile content and action promptly' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: flag.id, userId: owner,
          attemptId: fix.attemptId, idempotencyKey: 'slow-replay-check:' + flag.checkId, source: 'MCP' })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Slow visibility repair was not admitted')
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.verificationAuditId!, workKind: 'slow-replay' } })
        expect((await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, workKind: { not: null } },
          select: { workKind: true } })).map(row => row.workKind).sort()).toEqual(['finalize', 'slow-replay'])
        const repairedObservation = slowReplayResultSchema.parse(readArtifact(task.workResult, 'slow-replay').data.result)
        expect(repairedObservation).toMatchObject({ navigationComplete: true, complete: true })
        if (flag.checkId === 'slow-3g-cta-delayed') expect(repairedObservation.actions).toEqual(expect.arrayContaining([
          expect.objectContaining({ selector: '#renamed', label: 'Get started', timeToVisibleMs: expect.any(Number) }),
        ]))
        expect(checkVerifierSchema.parse((await prisma.auditVerifierExecution.findFirstOrThrow({ where: {
          auditId: run.verificationAuditId!, targetKey: 'check:' + flag.checkId,
        } })).detail)).toMatchObject({ comparable: true, verdict: 'passed', source: 'rendered-dom' })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: run.verificationAuditId })
        expect(await getOwnedRun(owner, run.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: competingFlag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: expect.any(String) })
      expect(await loadSiteFlags((await loadSiteRecord(siteId))!)).toEqual([])
      slowReplayMode = 'delayed'
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WATCH', idempotencyKey: 'slow-replay-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, targetKey: 'task:discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 10_000, interval: 100 }).catch(async error => {
        const pending = await prisma.auditVerifierExecution.findMany({ where: { auditId: recurrence.auditId!, workState: { not: 'COMPLETED' }, workKind: { not: null } },
          select: { targetKey: true, workKind: true, workState: true, workErrorCode: true, workAttempts: true } })
        throw new Error('Slow connection discovery unfinished: ' + JSON.stringify(pending), { cause: error })
      })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: recurrence.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 30_000, interval: 100 }).catch(async error => {
        const pending = await prisma.auditVerifierExecution.findMany({ where: { auditId: recurrence.auditId!, workState: { not: 'COMPLETED' }, workKind: { not: null } },
          select: { targetKey: true, workKind: true, workState: true, workErrorCode: true, workAttempts: true } })
        throw new Error('Slow connection recurrence unfinished: ' + JSON.stringify(pending), { cause: error })
      })
      for (const original of flags) {
        const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence.auditId!, checkId: original.checkId }, include: { improvementOccurrence: true } })
        expect(repeated.status).toBe('REGRESSED')
        expect(repeated.improvementOccurrence).toMatchObject({ improvementId: original.improvementOccurrence!.improvementId, kind: 'REGRESSED' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'FIXED', resolvedInId: expect.any(String) })
      }
    } finally {
      slowReplayMode = 'delayed'
      await prisma.user.delete({ where: { id: owner } })
      await resumeExternalQueues()
      transport.mockRestore()
    }
  }, 120_000)

  it('verifies mobile tap-target repair under the original provider criteria and preserves scheduled recurrence', async () => {
    await resumeExternalQueues()
    const transport = fixtureTransport(), pageUrl = origin + '/performance-fixture'
    const tapUserId = userId + '-tap-targets', tapSiteId = projectId + '-tap-targets'
    await prisma.user.create({ data: { id: tapUserId, email: tapUserId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: tapSiteId, userId: tapUserId, name: 'Tap-target fixture', canonicalHost: 'example.com', url: pageUrl } })
    try {
      pageSpeedMode = 'healthy'; mobileTapMode = 'failed'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true, strategies: ['mobile'] })
      expect(measured.mobile?.tapTargetAudits).toMatchObject([{ id: 'target-size', score: 0, itemsCount: 1 }])
      const flags = runMobileChecks(measured.mobile, pageUrl).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['tap-targets-small'])
      const source = await prisma.audit.create({ data: { projectId: tapSiteId, userId: tapUserId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { mobile: measured.mobile! } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'tap-targets-small': 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'tap-targets-small' } })
      let repairedAuditId: string | undefined
      for (const mode of ['missing', 'different', 'failed', 'engine', 'redirect', 'profile', 'scope-missing', 'healthy'] as const) {
        const changedCondition = mode === 'engine' || mode === 'redirect' || mode === 'profile' || mode === 'scope-missing'
        mobileTapMode = changedCondition ? 'healthy' : mode
        performanceScopeMode = changedCondition ? mode === 'scope-missing' ? 'missing' : mode : 'original'
        const fix = await recordSiteFlagFix({ siteId: tapSiteId, userId: tapUserId, flagId: flag.id,
          idempotencyKey: 'tap-target-fix:' + mode, changeSummary: 'Increase target size and spacing' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: tapSiteId, userId: tapUserId,
          flagId: flag.id, attemptId: fix.attemptId, idempotencyKey: 'tap-target-verify:' + mode })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Tap-target verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 20_000, interval: 100 })
        const expected = mode === 'healthy' ? 'IMPROVED' : mode === 'failed' ? 'UNCHANGED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: expected, comparable: expected !== 'INCONCLUSIVE', verificationAuditId: run.verificationAuditId })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, targetKey: { startsWith: 'task:' } },
          select: { workKind: true, workInput: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'pagespeed'])
        expect(tasks.find(task => task.workKind === 'pagespeed')!.workInput).toMatchObject({ device: 'mobile' })
        if (mode === 'missing') {
          const unknown = await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } })
          const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: unknown.id, targetKey: { startsWith: 'module:' } },
            select: { targetKey: true, status: true, detail: true } })
          const coverage = buildCoverageFacts({ auditStatus: unknown.status, completedAt: unknown.completedAt, now: new Date(),
            evidenceCoverage: unknown.evidenceCoverage, failedModules: unknown.failedModules, flags: [], verifierExecutions: receipts })
          expect(coverage.find(fact => fact.area === 'conversion')?.incompleteReason).toBeTruthy()
          expect(coverage.find(fact => fact.area === 'performance')?.incompleteReason).toBeFalsy()
        }
        if (mode === 'healthy') repairedAuditId = run.verificationAuditId!
        else expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repairedAuditId })
      releaseResources(); await getAuditTaskQueue('browser').resume(); mobileTapMode = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const recurring = await requestScheduledSiteRun({ projectId: tapSiteId, userId: tapUserId, interval: 'weekly', scheduledAt: tick, now: tick })
      await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: recurring.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 100 })
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repairedAuditId })
    } finally { pageSpeedMode = null; mobileTapMode = null; performanceScopeMode = 'original'; transport.mockRestore() }
  }, 120_000)

  it('detects mobile resource failures alongside healthy desktop data and independently verifies mobile repairs through the worker', async () => {
    await resumeExternalQueues()
    const transport = fixtureTransport()
    const pageUrl = origin + '/performance-fixture'
    const mobileUserId = userId + '-mobile-resources', mobileSiteId = projectId + '-mobile-resources'
    await prisma.user.create({ data: { id: mobileUserId, email: mobileUserId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: mobileSiteId, userId: mobileUserId, name: 'Mobile resource fixture', canonicalHost: 'example.com', url: pageUrl } })
    try {
      pageSpeedMode = 'healthy'; mobileResourceMode = 'failed'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true })
      expect(measured.desktop).not.toBeNull(); expect(measured.mobile).not.toBeNull()
      expect(runPerformanceChecks(measured.desktop, null, pageUrl)).toEqual([])
      const flags = runMobileChecks(measured.mobile, pageUrl).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['mobile-render-blocking', 'mobile-unused-js-large', 'mobile-unused-css-large', 'mobile-unoptimized-images'])
      const source = await prisma.audit.create({ data: { projectId: mobileSiteId, userId: mobileUserId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { desktop: measured.desktop!, mobile: measured.mobile! } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'mobile-render-blocking': 1, 'mobile-unused-js-large': 1, 'mobile-unused-css-large': 1, 'mobile-unoptimized-images': 1 })
      await materializeAttentionForAudit(source.id)
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      async function verify(flag: typeof findings[number], phase: string) {
        const fix = await recordSiteFlagFix({ siteId: mobileSiteId, userId: mobileUserId, flagId: flag.id,
          idempotencyKey: 'mobile-resource-fix:' + flag.id + ':' + phase, changeSummary: 'Improve resources in the mobile page' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: mobileSiteId, userId: mobileUserId, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'mobile-resource-verify:' + flag.id + ':' + phase })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Mobile resource verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 20_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId!, targetKey: { startsWith: 'task:' } },
          select: { workKind: true, workInput: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'pagespeed'])
        expect(tasks.find(task => task.workKind === 'pagespeed')!.workInput).toMatchObject({ device: 'mobile' })
        return { auditId: run.verificationAuditId!, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      const javascript = findings.find(flag => flag.checkId === 'mobile-unused-js-large')!
      mobileResourceMode = 'missing'
      const unknown = await verify(javascript, 'missing')
      expect(unknown.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: javascript.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unknown.auditId, targetKey: 'check:mobile-unused-js-large' } })).toBeNull()
      mobileResourceMode = 'different'
      for (const checkId of ['mobile-render-blocking', 'mobile-unoptimized-images']) {
        const original = findings.find(flag => flag.checkId === checkId)!
        expect((await verify(original, 'changed-criteria')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'OPEN' })
      }
      mobileResourceMode = 'healthy'
      for (const flag of findings) {
        const repaired = await verify(flag, 'healthy')
        expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ source: 'pagespeed-mobile', verdict: 'passed' })
      }
      releaseResources(); await getAuditTaskQueue('browser').resume(); mobileResourceMode = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const recurring = await requestScheduledSiteRun({ projectId: mobileSiteId, userId: mobileUserId, interval: 'weekly', scheduledAt: tick, now: tick })
      await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: recurring.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 100 })
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: javascript.checkId } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: javascript.fingerprint })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: javascript.id } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally { pageSpeedMode = null; mobileResourceMode = null; transport.mockRestore() }
  }, 120_000)

  it('verifies Performance score and resource repairs from fresh provider observations through the worker', async () => {
    await resumeExternalQueues()
    try {
      const pageUrl = origin + '/performance-fixture'
      pageSpeedMode = 'failed'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true, strategies: ['desktop'] })
      expect(measured.desktop).not.toBeNull()
      const flags = runPerformanceChecks(measured.desktop, null, pageUrl).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['perf-score-critical', 'render-blocking', 'unused-js-large', 'unused-css-large', 'unoptimized-images'])
      // The historical source is created from the real collector and detector.
      // Fresh verification uses normal admission, queue and application workers.
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { desktop: measured.desktop! } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'perf-score-critical': 1, 'render-blocking': 1, 'unused-js-large': 1, 'unused-css-large': 1, 'unoptimized-images': 1 })
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
      pageSpeedMode = 'different-resources'
      const changedCriteria = findings.filter(flag => ['render-blocking', 'unoptimized-images'].includes(flag.checkId!))
      for (const flag of changedCriteria) {
        await verify(flag, 'changed-criteria')
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get(flag.id)! } }))
          .toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
      pageSpeedMode = 'healthy'
      for (const flag of [scoreFlag, unusedJs]) for (const mode of ['engine', 'redirect', 'profile', 'missing'] as const) {
        performanceScopeMode = mode
        attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'performance-condition-fix:' + flag.id + ':' + mode, changeSummary: 'Recheck the original measurement conditions' })).attemptId)
        await verify(flag, 'condition-' + mode)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get(flag.id)! } }))
          .toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
      performanceScopeMode = 'original'
      for (const flag of findings) {
        // A fresh verification attempt follows the inconclusive resource check.
        attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'performance-fix-after-gap:' + flag.id, changeSummary: 'Confirm the newly measured resource savings' })).attemptId)
        const repaired = await verify(flag, 'healthy')
        expect(await prisma.improvementAttempt.findUnique({ where: { id: attempts.get(flag.id)! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
          verificationAuditId: repaired.auditId })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        expect(await prisma.flag.count({ where: { auditId: repaired.auditId! } })).toBe(0)
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'pagespeed-desktop' })
      }
    } finally { pageSpeedMode = null; performanceScopeMode = 'original' }
  }, 45_000)

  it.each(['desktop', 'mobile'] as const)('retains a comparable %s image failure through partial provider evidence and then verifies complete recovery', async device => {
    await resumeExternalQueues()
    const owner = userId + '-partial-images-' + device, siteId = projectId + '-partial-images-' + device
    const pageUrl = origin + '/performance-fixture'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Partial image resource fixture', canonicalHost: 'example.com', url: pageUrl } })
    try {
      pageSpeedMode = 'healthy'; resourceImageMode = 'original'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true, strategies: [device] })
      const data = measured[device]!
      const flags = (device === 'desktop' ? runPerformanceChecks(data, null, pageUrl) : runMobileChecks(data, pageUrl))
        .filter(flag => flag.checkId.endsWith('unoptimized-images')).map(flag => ({ ...flag, pageUrl }))
      expect(flags).toHaveLength(1); expect(flags[0].evidenceTargets).toHaveLength(2)
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { [device]: data } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { [device === 'desktop' ? 'unoptimized-images' : 'mobile-unoptimized-images']: 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id } })
      async function verify(phase: string) {
        const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id,
          idempotencyKey: 'partial-images-fix:' + device + ':' + phase, changeSummary: 'Recheck both original image audit conditions' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id, attemptId: fix.attemptId,
          idempotencyKey: 'partial-images-verify:' + device + ':' + phase })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Partial image verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 15_000, interval: 100 })
        return { run, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      resourceImageMode = 'partial-failed'
      const unchanged = await verify('known-failure')
      expect(unchanged.attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      expect(await getOwnedRun(owner, unchanged.run.runId!)).toMatchObject({ result: 'FLAG' })
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: unchanged.run.verificationAuditId!, targetKey: 'check:' + flag.checkId } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'failed', source: 'pagespeed-' + device,
        assertion: { passed: false, complete: true, observed: expect.stringContaining('1 of 2 original comparisons remain unavailable'),
          measurements: [{ passed: false, observed: expect.stringContaining('uses-optimized-images') }] } })
      for (const mode of ['partial-healthy', 'different-failure'] as const) {
        resourceImageMode = mode
        const unknown = await verify(mode)
        expect(unknown.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unknown.run.verificationAuditId!, targetKey: 'check:' + flag.checkId } })).toBeNull()
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      }
      resourceImageMode = 'partial-failed'; performanceScopeMode = 'profile'
      expect((await verify('different-profile')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      performanceScopeMode = 'original'; resourceImageMode = 'healthy'
      const repaired = await verify('complete-repair')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await getOwnedRun(owner, repaired.run.runId!)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.run.verificationAuditId })
    } finally { resourceImageMode = null; pageSpeedMode = null; performanceScopeMode = 'original' }
  }, 60_000)

  it('verifies each original resource page under its own provider criteria after findings merge', async () => {
    await resumeExternalQueues()
    const resourceOwner = userId + '-resource-pages', resourceSite = projectId + '-resource-pages'
    const urls = [origin + '/resource-criteria-first', origin + '/performance-peer']
    await prisma.user.create({ data: { id: resourceOwner, email: resourceOwner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: resourceSite, userId: resourceOwner, name: 'Resource criteria pages',
      canonicalHost: 'example.com', url: urls[0], watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() + 86400_000) } })
    try {
      resourcePeerCriteria = true; pageSpeedMode = 'failed'
      const measured = await Promise.all(urls.map(url => fetchPageSpeedData(url, undefined, { fresh: true, singleAttempt: true, strategies: ['desktop'] })))
      const flags = measured.flatMap((data, index) => runPerformanceChecks(data.desktop, null, urls[index])
        .filter(flag => flag.checkId === 'unoptimized-images').map(flag => ({ ...flag, pageUrl: urls[index] })))
      expect(flags).toHaveLength(2)
      expect(flags[0].evidenceTargets?.[0].label).toBe('image-delivery-insight')
      expect(flags[1].evidenceTargets?.[0].label).toBe('uses-optimized-images')
      const source = await prisma.audit.create({ data: { userId: resourceOwner, projectId: resourceSite, url: urls[0],
        status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(), performanceData: { desktop: measured[0].desktop! } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'unoptimized-images': 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'unoptimized-images' } })
      expect(flag.affectedPaths).toEqual(urls)
      expect(flag.evidenceTargets).toHaveLength(2)
      async function verify(phase: string) {
        const fixed = await recordSiteFlagFix({ siteId: resourceSite, userId: resourceOwner, flagId: flag.id,
          idempotencyKey: 'resource-pages-fix:' + phase, changeSummary: 'Repair the resource audit on both original pages' })
        const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: resourceSite, userId: resourceOwner, flagId: flag.id,
          attemptId: fixed.attemptId, idempotencyKey: 'resource-pages-verify:' + phase })
        if (!run.ok || !('verificationAuditId' in run)) throw new Error('Resource page verification was not admitted')
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 20_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.verificationAuditId, workKind: 'pagespeed' } })
        expect(tasks.map(task => task.pageUrl).sort()).toEqual([...urls].sort())
        return { auditId: run.verificationAuditId, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } }) }
      }
      expect((await verify('unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      pageSpeedMode = 'healthy'
      const repaired = await verify('healthy')
      expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
      const proofs = await prisma.auditVerifierExecution.findMany({ where: { auditId: repaired.auditId, targetKey: 'check:unoptimized-images' } })
      expect(proofs).toHaveLength(2)
      for (const proof of proofs) expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'pagespeed-desktop' })
    } finally { resourcePeerCriteria = false; pageSpeedMode = null }
  }, 60_000)

  it('retains missing desktop and mobile lab vitals as explicit unknown observations before genuine repair', async () => {
    await resumeExternalQueues()
    const transport = fixtureTransport()
    try {
      const pageUrl = origin + '/performance-fixture'
      pageSpeedMode = 'failed-vitals'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true })
      const flags = [...runPerformanceChecks(measured.desktop, null, pageUrl), ...runMobileChecks(measured.mobile, pageUrl)].map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId).sort()).toEqual(['cls-critical', 'lcp-critical', 'mobile-cls-critical', 'mobile-lcp-critical'])
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', completedAt: new Date(),
        performanceData: { desktop: measured.desktop!, mobile: measured.mobile! } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'lcp-critical': 1, 'cls-critical': 1, 'mobile-lcp-critical': 1, 'mobile-cls-critical': 1 })
      await materializeAttentionForAudit(source.id)
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      for (const phase of ['missing-vitals', 'healthy'] as const) {
        pageSpeedMode = phase
        for (const flag of findings) {
          const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
            idempotencyKey: 'vitals-fix:' + flag.id + ':' + phase, changeSummary: 'Restore comparable lab loading and layout measurements' })
          const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
            idempotencyKey: 'vitals-check:' + flag.id + ':' + phase,
            verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: fix.attemptId } })
          await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: admitted.auditId! } }))
            .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 15_000, interval: 50 })
          const mobile = flag.checkId!.startsWith('mobile-')
          const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: admitted.auditId!, targetKey: 'module:' + (mobile ? 'mobile' : 'performance') } })
          const detail = receipt.detail as { complete: boolean; assertions: Array<{ key: string; passed: boolean; complete: boolean }> }
          for (const key of ['lcp', 'cls']) expect(detail.assertions.find(assertion => assertion.key === key))
            .toMatchObject({ complete: phase === 'healthy', passed: phase === 'healthy' })
          expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
            .toMatchObject({ outcome: phase === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE', comparable: phase === 'healthy' })
          expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'healthy' ? 'FIXED' : 'OPEN' })
        }
      }
    } finally { pageSpeedMode = null; transport.mockRestore() }
  }, 60_000)

  it('keeps two availability responsibilities independent even when their binding keys match', async () => {
    const transport = fixtureTransport()
    try {
      await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
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

  it.skipIf(process.env.FIX_INTENTS_DB_REQUIRED !== 'true')('follows authenticated MCP repair handoffs through independent worker proof and consistent Flag state', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/headers'
    const owner = 'mcp-repair-owner-' + suffix, siteId = 'mcp-repair-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'MCP repair fixture', url: origin, canonicalHost: 'example.com' } })
    async function credential(accountId: string, scopes: string[]) {
      const generated = generateApiKey()
      const stored = await prisma.apiKey.create({ data: { userId: accountId, name: 'Disposable MCP proof', scopes,
        keyHash: generated.keyHash, prefix: generated.prefix, lastFour: generated.lastFour, expiresAt: new Date(Date.now() + 60_000) } })
      return { id: stored.id, raw: generated.rawKey }
    }
    const writer = await credential(owner, ['sites:read', 'flags:write', 'runs:read'])
    const reader = await credential(owner, ['sites:read', 'flags:read', 'runs:read'])
    const stranger = await credential(userId, ['flags:read'])
    let sequence = 0
    async function call(key: string, tool: string, args: Record<string, unknown>) {
      const endpoint = getAppUrl() + '/api/mcp'
      const response = await handleMcpPost(new NextRequest(endpoint, { method: 'POST', headers: {
        authorization: 'Bearer ' + key, host: new URL(endpoint).host, 'content-type': 'application/json', accept: 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION, 'Mcp-Method': 'tools/call', 'Mcp-Name': tool,
      }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name: tool, arguments: args, _meta: {
        'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': { name: 'local-worker-proof', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      } } }) }))
      const body = await response.json() as { result?: { isError?: boolean; structuredContent?: Record<string, unknown> }; error?: unknown }
      return { response, body }
    }
    async function invoke(tool: string, args: Record<string, unknown>, key = writer.raw) {
      const { response, body } = await call(key, tool, args)
      expect(response.status, JSON.stringify(body)).toBe(200)
      expect(body.result?.isError, JSON.stringify(body)).not.toBe(true)
      expect(body.result?.structuredContent).toBeDefined()
      return body.result!.structuredContent!
    }
    try {
      headerMode = 'partial'
      const document = await collectDocument(pageUrl, Date.now() + 8000)
      const finding = runSecurityHeaderChecks(pageUrl, document.headers).find(flag => flag.checkId === 'security-hsts-too-short')!
      const source = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url: pageUrl, status: 'COMPLETED',
        isPublic: false, startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      await persistControlledNativeSource(source.id, [{ ...finding, pageUrl }], { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'security-hsts-too-short': 1 })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: finding.checkId }, include: { improvementOccurrence: true } })
      const flagId = flag.improvementOccurrence!.improvementId
      expect((await invoke(MCP_TOOLS.getFlag.name, { siteId, flagId }, reader.raw)).flag).toMatchObject({
        sourceFlagId: flag.id, status: 'PROPOSED', verificationState: 'still_open', sourceAuditId: source.id, affectedPaths: [pageUrl],
      })
      const change = { siteId, flagId, idempotencyKey: 'mcp-repair-intent', changeSummary: 'Restore the recorded response header' }
      const denied = await call(reader.raw, MCP_TOOLS.recordFix.name, change)
      expect(denied.response.status).toBe(403)
      expect(denied.body.error).toMatchObject({ data: { code: 'INSUFFICIENT_SCOPE' } })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: flagId } })).toBe(0)
      const recorded = await invoke(MCP_TOOLS.recordFix.name, change)
      const next = recorded.next as { tool: string; arguments: Record<string, unknown> }
      expect(next.arguments.idempotencyKey).toBe('flag-verify:' + recorded.attemptId)
      expect((await invoke(MCP_TOOLS.recordFix.name, change)).next).toEqual(next)
      headerMode = 'healthy'
      const accepted = await invoke(next.tool, next.arguments)
      const pending = accepted.next as { tool: string; arguments: Record<string, unknown> }
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: accepted.auditId as string } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(await invoke(pending.tool, pending.arguments, reader.raw)).toMatchObject({ result: 'CLEAR', scope: 'DIAGNOSTIC', completionState: 'FULL' })
      expect((await invoke(MCP_TOOLS.getFlag.name, { siteId, flagId: flag.id }, reader.raw)).flag).toMatchObject({
        sourceFlagId: flag.id, status: 'FIXED', verificationState: 'verified', sourceAuditId: source.id,
        attempts: expect.arrayContaining([expect.objectContaining({ id: recorded.attemptId, outcome: 'IMPROVED', comparable: true })]),
      })
      expect(await invoke(next.tool, next.arguments)).toMatchObject({ runId: accepted.runId, auditId: accepted.auditId })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: flagId } })).toBe(1)
      expect(await prisma.runRequest.count({ where: { projectId: siteId } })).toBe(1)
      const privateRead = await call(stranger.raw, MCP_TOOLS.getFlag.name, { siteId, flagId })
      expect(privateRead.body.result).toMatchObject({ isError: true, structuredContent: { status: 'ERROR', error: { code: 'NOT_FOUND' } } })
      expect(await prisma.mcpInteraction.findFirst({ where: { apiKeyId: stranger.id, tool: MCP_TOOLS.getFlag.name },
        orderBy: { createdAt: 'desc' }, select: { success: true, errorCode: true } })).toEqual({ success: false, errorCode: 'NOT_FOUND' })
      await prisma.apiKey.update({ where: { id: reader.id }, data: { revokedAt: new Date() } })
      expect((await call(reader.raw, MCP_TOOLS.getFlag.name, { siteId, flagId })).response.status).toBe(401)
    } finally {
      headerMode = 'failed'
      await prisma.apiKey.delete({ where: { id: stranger.id } })
      await prisma.user.delete({ where: { id: owner } })
      transport.mockRestore()
    }
  }, 30_000)

  it.skipIf(process.env.FIX_INTENTS_DB_REQUIRED !== 'true').each(['incident', 'capture'] as const)
    ('verifies the frozen repair scope after monitoring advances a durable issue to another page: %s', async address => {
    const transport = fixtureTransport(), originalUrl = origin + '/headers', laterUrl = origin + '/headers-other'
    const owner = 'frozen-source-owner-' + suffix, siteId = 'frozen-source-site-' + suffix
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Frozen repair scope', url: origin, canonicalHost: 'example.com' } })
    try {
      headerMode = 'partial'
      async function observe(url: string) {
        const document = await collectDocument(url, Date.now() + 8000)
        const finding = runSecurityHeaderChecks(url, document.headers).find(flag => flag.checkId === 'security-hsts-too-short')!
        const audit = await prisma.audit.create({ data: { projectId: siteId, userId: owner, url, status: 'COMPLETED',
          isPublic: false, startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
        await persistControlledNativeSource(audit.id, [{ ...finding, pageUrl: url }], { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'security-hsts-too-short': 1 })
        await materializeAttentionForAudit(audit.id)
        return prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: finding.checkId }, include: { improvementOccurrence: true } })
      }
      const original = await observe(originalUrl), incidentId = original.improvementOccurrence!.improvementId
      const before = address === 'incident' ? await recordSiteFlagFix({ siteId, userId: owner, flagId: incidentId,
        idempotencyKey: 'frozen-source-fix', changeSummary: 'Repair the recorded original response' }) : null
      const later = await observe(laterUrl)
      const fix = before ?? await recordSiteFlagFix({ siteId, userId: owner, flagId: original.id,
        idempotencyKey: 'frozen-source-fix', changeSummary: 'Repair the displayed original response' })
      expect(later.improvementOccurrence!.improvementId).toBe(incidentId)
      expect(await loadSiteFlagDetail((await loadSiteRecord(siteId))!, incidentId)).toMatchObject({ sourceAuditId: later.auditId, pageUrl: laterUrl })
      await expect(executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: later.id, attemptId: fix.attemptId,
        source: 'MCP', idempotencyKey: 'wrong-raw-source' })).rejects.toMatchObject({ status: 409 })
      headerMode = 'healthy'
      const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: address === 'capture' ? original.id : incidentId,
        attemptId: fix.attemptId, source: address === 'capture' ? 'WEB' : 'MCP' })
      if (!run.ok || !('verificationAuditId' in run)) throw new Error('Frozen source verification was not admitted')
      expect(run.parentAuditId).toBe(original.auditId)
      expect(run.flagId).toBe(address === 'capture' ? original.id : incidentId)
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: run.verificationAuditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } })).executionSpec))
        .toMatchObject({ scope: 'DIAGNOSTIC', targetUrl: originalUrl, verificationTarget: { parentAuditId: original.auditId, attemptId: fix.attemptId } })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
        sourceAuditId: original.auditId, outcome: 'IMPROVED', comparable: true, verificationAuditId: run.verificationAuditId,
      })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'FIXED', resolvedInId: run.verificationAuditId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: later.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      const currentSite = (await loadSiteRecord(siteId))!
      expect(await loadSiteFlagDetail(currentSite, incidentId)).toMatchObject({ sourceAuditId: later.auditId,
        status: 'PROPOSED', verificationState: 'still_open' })
      expect(await loadSiteFlags(currentSite)).toEqual(expect.arrayContaining([expect.objectContaining({
        id: incidentId, sourceFlagId: later.id, status: 'PROPOSED',
      })]))
      expect(await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: address === 'capture' ? original.id : incidentId,
        attemptId: fix.attemptId, source: address === 'capture' ? 'WEB' : 'MCP' }))
        .toMatchObject({ runId: run.runId, verificationAuditId: run.verificationAuditId, attemptId: fix.attemptId,
          flagId: address === 'capture' ? original.id : incidentId })
      await expect(executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: later.id, attemptId: fix.attemptId,
        source: 'MCP' })).rejects.toMatchObject({ status: 409 })
      expect(await prisma.runRequest.count({ where: { projectId: siteId } })).toBe(1)
      expect(await getOwnedRun(owner, run.runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
      expect(await getOwnedRun('other-owner', run.runId)).toBeNull()
    } finally {
      headerMode = 'failed'
      await prisma.user.delete({ where: { id: owner } })
      transport.mockRestore()
    }
  }, 30_000)

  it.skipIf(process.env.FIX_INTENTS_DB_REQUIRED !== 'true')('preserves immutable fix intents under concurrent retries, later repairs and exact worker reconciliation', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/headers'
    try {
      headerMode = 'partial'
      const document = await collectDocument(pageUrl, Date.now() + 8000)
      const finding = runSecurityHeaderChecks(pageUrl, document.headers).find(flag => flag.checkId === 'security-hsts-too-short')!
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      await persistControlledNativeSource(source.id, [{ ...finding, pageUrl }], { MESSAGE: null, EXPERIENCE: null, REACH: null }, { 'security-hsts-too-short': 1 })
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

  it('executes registered structure and control identifier responsibilities through native collection, repair and recurrence', async () => {
    releaseResources()
    const transport = fixtureTransport(), owner = userId + '-structure', site = projectId + '-structure'
    const pageUrl = origin + '/structure', missingUrl = origin + '/structure-missing'
    const expected = ['axe-duplicate-id-active', 'heading-order-skipped', 'axe-landmark-banner', 'axe-landmark-contentinfo', 'axe-landmark-main',
      'axe-landmark-duplicate', 'axe-landmark-one-main', 'axe-missing-h1']
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, name: 'Page structure checking', url: pageUrl, canonicalHost: 'example.com' } })
    // This seed supplies discovered URLs only, without a passing observation.
    await prisma.audit.create({ data: { projectId: site, userId: owner, url: pageUrl, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: [pageUrl, missingUrl].map((url, position) => ({ url, normalizedUrl: url, role: position ? 'linked' : 'primary', position, status: 'COMPLETED' })) } } })
    try {
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      async function complete(auditId: string) {
        await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 40_000, interval: 200 })
      }
      async function category(phase: string) {
        const run = await requestSiteRun({ projectId: site, userId: owner, scope: 'CATEGORY', categoryArea: 'accessibility', source: 'WEB', outcomeIds: [], idempotencyKey: 'structure:' + phase })
        await complete(run.auditId!); return run.auditId!
      }
      const source = await category('source')
      const flags = await prisma.flag.findMany({ where: { auditId: source, checkId: { in: expected } } })
      expect(flags.map(flag => flag.checkId).sort()).toEqual([...expected].sort())
      for (const flag of flags) expect(flag).toMatchObject({ verificationRule: expect.stringContaining('Accessibility observation'),
        evidenceTargets: expect.arrayContaining([expect.objectContaining({ context: expect.stringContaining('accessibility:axe:desktop:') })]) })
      async function verify(flag: typeof flags[number], phase: string) {
        const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, idempotencyKey: 'structure-fix:' + phase + ':' + flag.checkId,
          changeSummary: 'Restore the recorded landmark or heading responsibility' })
        const run = await requestSiteRun({ projectId: site, userId: owner, outcomeIds: [], source: 'WEB', idempotencyKey: 'structure-verify:' + phase + ':' + flag.checkId,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, parentAuditId: source, attemptId: fix.attemptId } })
        await complete(run.auditId!)
        return { auditId: run.auditId!, attempt: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }) }
      }
      const main = flags.find(flag => flag.checkId === 'axe-landmark-one-main')!
      expect((await verify(main, 'unchanged')).attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      structureUnavailable = true
      expect((await verify(main, 'unavailable')).attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: main.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      structureUnavailable = false; structureHealthy = true
      for (const flag of flags) {
        const repaired = await verify(flag, 'repaired')
        expect(repaired.attempt, flag.checkId!).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
      }
      structureHealthy = false
      const repeated = await category('recurrence')
      for (const flag of flags) {
        const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: repeated, checkId: flag.checkId } })
        const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
        expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
        expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
      }
    } finally { structureHealthy = false; structureUnavailable = false; await prisma.user.delete({ where: { id: owner } }); transport.mockRestore() }
  }, 240_000)

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
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
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
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'accessibility-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, workKind: 'discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues(); transport.mockRestore()
    }
  }, 100_000)

  it.skipIf(process.env.CONSOLE_DB_REQUIRED !== 'true')('proves scoped console failure, partial repair, unavailable captures, independent viewport failure and recurrence through Chromium and workers', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/console', other = origin + '/console-linked'
    try {
      await getAuditTaskQueue('browser').resume()
      const sourceCaptures = await Promise.all([pageUrl, other].map(url => captureScreenshots(url, 'console-source', undefined,
        { runFlow: false, captureMedia: false, consoleObservationMs: 5000, deadline: Date.now() + 24_000 })))
      const flags = sourceCaptures.flatMap((snapshot, index) => {
        expect(snapshot.consoleErrors.map(error => error.text).sort()).toEqual(['Console failure 0', 'Console failure 1', 'Unhandled page failure'])
        expect(snapshot.consoleCoverage).toMatchObject({ phase: 'page_load', desktop: { complete: true, errors: 3 }, mobile: { complete: true, errors: 3 } })
        return runConsoleChecks(snapshot.consoleErrors, snapshot.consoleCoverage).map(flag => ({ ...flag, pageUrl: [pageUrl, other][index] }))
      })
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', reviewDepth: 2,
        startedAt: new Date(), completedAt: new Date(), reportCompleteness: 'PARTIAL', executionSpec: { version: 1, engine: 'progressive-v1',
          targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: { 'console-errors-critical': 1, 'console-errors-some': 1 }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
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
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'console-recurrence' })
      // Discovery follows completed observations of both viewports. It cannot
      // be required before their observation horizons have elapsed.
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: recurrence.auditId!, workKind: 'discovery' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues(); transport.mockRestore()
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
        { runFlow: false, captureMedia: false, consoleObservationMs: 5000, deadline: Date.now() + 24_000 })
      expect(captured.consoleCoverage).toMatchObject({ desktop: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 },
        mobile: { complete: true, finalUrl: origin + '/console-redirect', errors: 0 } })
      expect(captured.consoleCoverage!.desktop.observedMs).toBeGreaterThanOrEqual(5000)
      expect(captured.consoleCoverage!.mobile.observedMs).toBeGreaterThanOrEqual(5000)
    } finally { consoleRedirected = false; consoleRedirectDelayMs = 0; consoleRootErrors = 3; transport.mockRestore() }
  }, 30_000)

  it('retains real HTTP and native Accessibility evidence after terminating metadata parser workers', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/parser-isolation'
    const owner = userId + '-parser', siteId = projectId + '-parser'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Parser isolation fixture', canonicalHost: 'example.com', url: pageUrl } })
    const nativePost = ParserWorker.prototype.postMessage
    let crash = true, crashes = 0
    const parserFault = vi.spyOn(ParserWorker.prototype, 'postMessage').mockImplementation(function(this: ParserWorker, ...args: Parameters<ParserWorker['postMessage']>) {
      const input = args[0]
      if (crash && input?.operation === 'metadata' && input.url === pageUrl) { crashes++; void this.terminate(); return }
      nativePost.apply(this, args)
    })
    const complete = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      const source = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'parser-source' })
      await complete(source.auditId!, true)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId! } })).toMatchObject({ status: 'COMPLETED', reportCompleteness: 'PARTIAL', failedModules: expect.arrayContaining(['metadata']) })
      expect(crashes).toBe(4)
      for (const kind of ['http', 'browser'] as const) {
        const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: kind } })
        expect(task).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
        expect(readArtifact(task.workResult, kind).data).toMatchObject({ metadata: null,
          metadataFailure: { attempts: 2, code: expect.stringMatching(/^PARSER_(CRASH|NO_RESULT)$/) } })
      }
      const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'browser' } })
      expect(readArtifact(browser.workResult, 'browser').data).toMatchObject({ snapshot: { consoleErrors: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('independent fixture script failure') })]),
        accessibilityEvidence: { rules: expect.arrayContaining([expect.objectContaining({ id: 'button-name', state: 'failed' })]) } } })
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'module:page-response' } }))
        .toMatchObject({ detail: { complete: true, passed: true } })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'buttons-no-text' } })
      const headerFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'security-headers-missing' } })
      expect(await prisma.flag.count({ where: { auditId: source.auditId!, checkId: 'title-missing' } })).toBe(0)
      // Full-document parser failure remains a report limitation. Independently
      // recorded native head observations can still settle their own checks.
      const nativeHead = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'module:metadata' } })
      expect(nativeHead).toMatchObject({ status: 'COMPLETED' })
      expect(checkReceiptSchema.parse(nativeHead.detail)).toMatchObject({ assertions: expect.arrayContaining([
        expect.objectContaining({ key: 'title-presence', passed: true, complete: true }),
        expect.objectContaining({ key: 'description-presence', passed: false, complete: true }),
      ]) })
      const presentation = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'task:p0:search-presentation' } })
      expect(searchArtifactSchema.parse(readArtifact(presentation.workResult, 'search').data).receipt.observations)
        .toEqual(expect.arrayContaining([expect.objectContaining({ checkId: 'title-missing', disposition: 'passed' })]))
      parserFixtureHeaders = true
      const headerFix = await recordSiteFlagFix({ siteId, userId: owner, flagId: headerFlag.id, idempotencyKey: 'parser-header-fix', changeSummary: 'Restore the original response header configuration' })
      const headerCheck = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: headerFlag.id, attemptId: headerFix.attemptId, idempotencyKey: 'parser-header-verify' })
      if (!headerCheck.ok || !('verificationAuditId' in headerCheck)) throw new Error('Parser-independent header verification was not admitted')
      await complete(headerCheck.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: headerFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      const headerResponse = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: headerCheck.verificationAuditId!, workKind: 'http' } })
      expect(readArtifact(headerResponse.workResult, 'http').data).toMatchObject({ metadata: null, metadataFailure: { attempts: 2 }, document: { status: 200 } })
      expect(crashes).toBe(6)
      crash = false; parserFixtureRepaired = true
      const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'parser-accessibility-fix', changeSummary: 'Name the original button' })
      const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id, attemptId: fix.attemptId, idempotencyKey: 'parser-accessibility-verify' })
      if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Parser-independent Accessibility verification was not admitted')
      await complete(admitted.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: admitted.verificationAuditId })
      expect(crashes).toBe(6)
    } finally { parserFault.mockRestore(); parserFixtureRepaired = false; parserFixtureHeaders = false; transport.mockRestore() }
  }, 100_000)

  it('verifies metadata presence repairs through fresh worker evidence and retains scheduled recurrence', async () => {
    const transport = fixtureTransport(), pageUrl = origin + '/metadata-presence'
    const owner = userId + '-metadata', siteId = projectId + '-metadata'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Metadata fixture', canonicalHost: 'example.com', url: pageUrl } })
    const ids = ['favicon-missing', 'og-image-missing', 'og-title-missing', 'og-description-missing', 'lang-missing', 'viewport-missing']
    const complete = (auditId: string, bounded = false) => vi.waitFor(async () => {
      if (bounded) {
        // Only the real metadata collection and evaluation supply repair evidence.
        // Unrelated provider, image and interaction work remains unavailable.
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
          workKind: { in: ['captures', 'pagespeed', 'google', 'keyboard', 'flow', 'slow-replay', 'journeys', 'motion', 'overlays'] } },
          data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 })
    try {
      releaseResources(); await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
      metadataPresenceMode = 'missing'
      const source = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'metadata-source' })
      await complete(source.auditId!, true)
      const flags = await prisma.flag.findMany({ where: { auditId: source.auditId!, checkId: { in: ids } } })
      expect(flags.map(flag => flag.checkId).sort()).toEqual([...ids].sort())
      const favicon = flags.find(flag => flag.checkId === 'favicon-missing')!
      const verify = async (flag: typeof favicon, phase: string) => {
        const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'metadata-fix:' + phase,
          changeSummary: 'Restore the missing declaration on the original page' })
        const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'metadata-verify:' + phase })
        if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Metadata verification was not admitted')
        await complete(admitted.verificationAuditId!)
        const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: admitted.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
        return { auditId: admitted.verificationAuditId!, attempt }
      }
      const unchanged = await verify(favicon, 'unchanged')
      expect(unchanged.attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      metadataPresenceMode = 'incomplete'
      const largeFailure = await verify(favicon, 'large-failure')
      expect(largeFailure.attempt).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
      expect((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: largeFailure.auditId, workKind: 'browser' } })).workResult)
        .toMatchObject({ data: { metadata: null, snapshot: { runtimeHeadMetadata: { hasFavicon: false }, desktopHtmlTruncated: true } } })
      metadataPresenceMode = 'unavailable'
      const incomplete = await verify(favicon, 'unavailable')
      expect(incomplete.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: favicon.id } })).toMatchObject({ status: 'OPEN' })
      metadataPresenceMode = 'oversized'
      const oversized = await verify(flags.find(flag => flag.checkId === 'og-title-missing')!, 'oversized-title')
      expect(oversized.attempt).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      const boundedHead = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: oversized.auditId, workKind: 'browser' } })
      const boundedSnapshot = readArtifact(boundedHead.workResult, 'browser').data as { snapshot: { runtimeHeadMetadata: Record<string, unknown> } }
      expect(boundedSnapshot.snapshot.runtimeHeadMetadata).not.toHaveProperty('ogTitle')
      expect(boundedSnapshot.snapshot.runtimeHeadMetadata.hasFavicon).toBe(true)
      metadataPresenceMode = 'healthy-large'
      for (const flag of flags) {
        const repaired = await verify(flag, flag.checkId!)
        expect(repaired.attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, workKind: 'browser' } })).workResult)
          .toMatchObject({ data: { metadata: null, snapshot: { runtimeHeadMetadata: { hasFavicon: true }, desktopHtmlTruncated: true } } })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', comparable: true, source: 'rendered-dom', assertion: { complete: true, passed: true } })
      }
      metadataPresenceMode = 'incomplete'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(watch.auditId!, true)
      const recurringIds: string[] = []
      for (const flag of flags) {
        const recurring = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
        recurringIds.push(recurring.id)
        expect(recurring).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
        const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
        expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } })).toMatchObject({ improvementId: original.improvementId })
      }
      metadataPresenceMode = 'healthy-large'
      const later = new Date(tick.getTime() + 8 * 24 * 60 * 60 * 1000)
      const recovery = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: later, now: later })
      await complete(recovery.auditId!, true)
      expect((await getFlagDiffSummary(watch.auditId!, recovery.auditId!)).fixed.map(flag => flag.checkId)).toEqual(expect.arrayContaining(ids))
      for (const id of recurringIds) expect(await prisma.flag.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'FIXED', resolvedInId: recovery.auditId })
    } finally { metadataPresenceMode = 'missing'; transport.mockRestore() }
  }, 180_000)

  it('retains metadata checks through inert hydration data while refusing oversized DOM evidence', async () => {
    releaseResources()
    await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
    const transport = fixtureTransport(), pageUrl = origin + '/trust'
    trustHydration = 'data'; trustPrivacy = true; trustContact = true; trustConsent = false; trustAnalytics = true
    async function complete(auditId: string) {
      await vi.waitFor(async () => expect(await prisma.audit.findUnique({ where: { id: auditId } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 30_000, interval: 100 }).catch(async error => {
        const pending = await prisma.auditVerifierExecution.findMany({ where: { auditId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
          select: { targetKey: true, workState: true, workErrorCode: true, workAttempts: true } })
        console.error('Hydration fixture pending task evidence:', pending)
        throw error
      })
    }
    try {
      const captured = await captureScreenshots(pageUrl, 'hydration-source', undefined,
        { runFlow: false, captureMedia: false, deadline: Date.now() + 20_000 })
      expect(captured).toMatchObject({ desktopHtmlCompacted: true, desktopHtmlTruncated: false })
      const metadata = parseMetadataFromHtml(captured.desktopHtml!, pageUrl)
      expect(metadata).toMatchObject({
        lang: 'en', hasAnalytics: true, hasCookieBasedAnalytics: true, hasCookieConsent: false, hasPrivacyPolicy: true, hasContactInfo: true })
      const flags = (await runAllChecks(pageUrl, metadata, null, null, [], undefined, undefined, undefined, undefined, true,
        ['trust'], { renderedScope: captured.renderedScope })).flags.map(flag => ({ ...flag, pageUrl }))
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
        reportCompleteness: 'PARTIAL', htmlMetadata: metadata as never, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { 'cookie-consent-absent': CHECK_REGISTRY['cookie-consent-absent'].version }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'cookie-consent-absent' } })
      trustConsent = true
      for (const phase of ['dom', 'data'] as const) {
        trustHydration = phase
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'hydration-fix-' + phase,
          changeSummary: 'Restore cookie settings on this page' })
        const repaired = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'hydration-verify-' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: fix.attemptId } })
        await complete(repaired.auditId!)
        const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, workKind: 'browser' } })
        expect(readArtifact(browser.workResult, 'browser').data.snapshot).toMatchObject({
          desktopHtmlCompacted: phase === 'data', desktopHtmlTruncated: phase === 'dom' })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: phase === 'data' ? 'IMPROVED' : 'INCONCLUSIVE', comparable: phase === 'data' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'data' ? 'FIXED' : 'OPEN' })
      }
    } finally {
      trustHydration = 'none'; trustPrivacy = false; trustContact = false; trustConsent = false; trustAnalytics = true
      transport.mockRestore()
    }
  }, 90_000)

  it.skipIf(process.env.PUBLIC_TRUST_DB_REQUIRED !== 'true')('proves public trust failures, independent fixes, unavailable evidence and recommendation recurrence through Chromium and the worker', async () => {
    releaseResources()
    const transport = fixtureTransport(), pageUrl = origin + '/trust'
    const repairedRuns: string[] = []
    try {
      await getAuditTaskQueue('browser').resume()
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, deadline: Date.now() + 8000 })
      let metadata, flags
      try {
        metadata = parseMetadataFromHtml(await session.page.content(), pageUrl)
        flags = (await runAllChecks(pageUrl, metadata, null, null, [], undefined, undefined, undefined, undefined, true,
          ['trust'], { renderedScope: auditPageObservation(session.page)?.scope })).flags.map(flag => ({ ...flag, pageUrl }))
      }
      finally { session.disposeNetwork(); await session.page.context().close() }
      expect(flags.map(flag => flag.checkId)).toEqual(['no-privacy-policy', 'no-contact-info', 'cookie-consent-absent'])
      // Source observations come from Chromium and the real parser
      // and detector. Every subsequent fix uses application admission and workers.
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
        reportCompleteness: 'PARTIAL', htmlMetadata: metadata as never, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
          environment: 'production', scope: 'SITE', checks: { 'no-privacy-policy': 1, 'no-contact-info': 1, 'cookie-consent-absent': CHECK_REGISTRY['cookie-consent-absent'].version }, outcomes: [], verificationTarget: null } } })
      await persistControlledNativeSource(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
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
      await persistProjectScanAccess(projectId, userId, { headers: { 'X-Preview': 'DIFFERENT_LOCAL_ACCESS' } })
      trustPrivacy = true
      await fix('no-privacy-policy', 'different-access')
      const differentAccess = await verify('no-privacy-policy', 'different-access')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get('no-privacy-policy')! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: privacy.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: differentAccess.auditId!, targetKey: 'check:no-privacy-policy' } })).toBeNull()
      await persistProjectScanAccess(projectId, userId, null)
      trustPrivacy = false
      await fix('no-privacy-policy', 'restore-public-comparison')
      trustUnavailable = true
      const unavailable = await verify('cookie-consent-absent', 'unavailable')
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempts.get('cookie-consent-absent')! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: consent.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unavailable.auditId!, targetKey: 'check:cookie-consent-absent' } })).toBeNull()
      trustUnavailable = false; trustAnalytics = false
      await fix('cookie-consent-absent', 'analytics-unobserved')
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
      await pauseExternalQueues()
      const recurrence = await requestSiteRun({ projectId, userId, outcomeIds: [], scope: 'SITE', source: 'WATCH', url: pageUrl, idempotencyKey: 'trust-recurrence' })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.count({ where: { auditId: recurrence.auditId!, workKind: 'search' } })).toBeGreaterThan(0)
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: recurrence.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurrence.auditId!)); await resumeExternalQueues()
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
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues(); transport.mockRestore()
    }
  }, 75_000)

  it.skipIf(process.env.SCHEDULED_SITE_CARE_REQUIRED !== 'true')('refreshes broad Site evidence and bound incidents through scheduled care, then reuses fresh evidence for uptime', async () => {
    releaseResources()
    const transport = fixtureTransport()
    // This scenario begins with a fresh incident. Earlier scenarios deliberately
    // retain failures on other pages, which cannot be cleared by this scope.
    const userId = 'scheduled-care-user-' + suffix
    const projectId = 'scheduled-care-project-' + suffix
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Scheduled care fixture', url: origin + '/', canonicalHost: 'example.com' } })
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
        await pauseExternalQueues()
        const run = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt, now: scheduledAt })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.count({ where: { auditId: run.auditId!, workKind: 'search' } })).toBeGreaterThan(0)
        }, { timeout: 10_000, interval: 100 })
        await prisma.auditVerifierExecution.updateMany({ where: { auditId: run.auditId!, workKind: { in: ['pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(run.auditId!))
        await getAuditTaskQueue('browser').resume(); await resumeExternalQueues()
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 100 }).catch(async error => {
          const pending = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, workState: { not: 'COMPLETED' }, workKind: { not: null } },
            select: { targetKey: true, workKind: true, workState: true, workErrorCode: true, workAttempts: true, workRetryAt: true } })
          console.error('Scheduled care did not finalize; remaining task states:', pending)
          throw error
        })
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
          expect(title.status).toBe('OPEN')
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
      await prisma.user.delete({ where: { id: userId } })
      availabilityStatus = 200; availabilityChallenged = false; monitoredTitleMissing = true; monitoredUnavailable = false
      await getAuditTaskQueue('browser').resume(); await resumeExternalQueues(); transport.mockRestore()
    }
  }, 90_000)

})
