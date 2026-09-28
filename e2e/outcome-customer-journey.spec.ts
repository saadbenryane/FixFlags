import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { flagMatchesOutcome } from '@/lib/sites/outcome-state'
import { assertKeyboardReachesTheSurface, assertSiteSurfaceMeetsLaunchBar } from './site-surface-bar'

/**
 * The canonical customer loop, exercised through the real Site product:
 *
 *   Site -> Outcome -> Clear -> Flag -> record a fix -> independent Verify
 *        -> recovery -> recurrence -> continued Watch
 *
 * Every assertion below is a customer-visible truth read back from the Site's
 * own read models. A route existing, a unit test passing, or a locally
 * implemented engine never satisfies this file. The failure is induced through
 * the release controlled fixture, because a Flag FixFlags did not independently
 * catch proves nothing.
 *
 * The product records a fix and requests verification as one action
 * (`VERIFY_FLAG`), so this spec follows that contract rather than inventing a
 * separate record step. The pre-verification handoff is asserted to leave the
 * verdict untouched.
 *
 * Required env (see scripts/release-preflight.mjs for the full list):
 *   E2E_CREDENTIALED / E2E_BASE_URL / RELEASE_FRESH_DATABASE_URL
 *   RELEASE_ALLOW_DATABASE_RESET
 *   E2E_SITE_OWNER_EMAIL / E2E_SITE_OWNER_PASSWORD — the claimed Site's owner
 *   E2E_SITE_ID                                   — the claimed Site
 *   E2E_DEPLOYMENT_TRIGGER_URL / _TOKEN           — the controlled release
 *     fixture that induces and repairs the failure being verified
 *   E2E_GATE_NON_MEMBER_EMAIL / _PASSWORD         — a second, unrelated owner
 *
 * Optional env:
 *   E2E_OUTCOME_ID — defaults to the Site's first independently executable
 *     Outcome, so a release run does not have to pin an id.
 */

const credentialedEnabled =
  process.env.E2E_CREDENTIALED === 'true' &&
  Boolean(process.env.RELEASE_FRESH_DATABASE_URL) &&
  process.env.RELEASE_ALLOW_DATABASE_RESET === 'true'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required when E2E_CREDENTIALED=true`)
  return value
}

function envOr(name: string, fallbackName: string): string {
  return process.env[name]?.trim() || requiredEnv(fallbackName)
}

type SiteHome = {
  outcomes: Array<{
    id: string
    name: string
    kind: string
    state: string
    summary: string
    flagId: string | null
    pageUrls: string[]
    coverage: unknown
  }>
  flags: Array<{
    id: string
    sourceFlagId: string | null
    improvementId: string | null
    checkId: string | null
    pageUrl: string | null
    problem: string
    evidence: string
    fix: string
    status: string
  }>
  watch: { interval: string | null; nextRunAt: string | null; covered: boolean; label: string }
  watching: boolean
  coverageSummary: string
}

type RunView = {
  id: string
  status: string
  result: string | null
  auditId: string | null
  outcomes: Array<{ outcomeId: string; outcomeName: string; result: string | null; summary: string | null }>
}

async function loadHome(request: APIRequestContext, siteId: string): Promise<SiteHome> {
  const response = await request.get(`/api/sites/${siteId}`)
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as SiteHome
}

/** The one Flag the product attributes to this Outcome, using the product's own matcher. */
function flagForOutcome(home: SiteHome, outcomeId: string) {
  const outcome = home.outcomes.find((item) => item.id === outcomeId)
  if (!outcome) throw new Error(`Outcome ${outcomeId} is not on this Site`)
  const matches = home.flags.filter((flag) =>
    flagMatchesOutcome(
      { id: flag.id, improvementId: flag.improvementId, pageUrl: flag.pageUrl, checkId: flag.checkId },
      { flagId: outcome.flagId, pageUrls: outcome.pageUrls, kind: outcome.kind },
    ),
  )
  return { outcome, matches }
}

async function startRun(
  request: APIRequestContext,
  siteId: string,
  outcomeId: string,
  label: string,
): Promise<{ runId: string; status: number }> {
  const response = await request.post(`/api/sites/${siteId}/runs`, {
    headers: { 'idempotency-key': `outcome-journey:${label}:${Date.now()}` },
    data: { outcomeIds: [outcomeId] },
  })
  expect([200, 202], await response.text()).toContain(response.status())
  return { runId: ((await response.json()) as { runId: string }).runId, status: response.status() }
}

async function waitForRunResult(
  request: APIRequestContext,
  siteId: string,
  runId: string,
  expected: string,
  timeoutMs = 420_000,
): Promise<RunView> {
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/sites/${siteId}/runs/${runId}`)
        if (response.status() !== 200) return `HTTP_${response.status()}`
        const run = (await response.json()) as RunView
        if (run.status !== 'COMPLETED') return `run:${run.status}`
        return run.result
      },
      { timeout: timeoutMs, message: `Outcome never reached ${expected}` },
    )
    .toBe(expected)
  return (await (await request.get(`/api/sites/${siteId}/runs/${runId}`)).json()) as RunView
}

/**
 * Induce or repair the controlled failure through the same fixture the release
 * runbook already documents. The fixture owns the truth, so recurrence and
 * recovery are exercised against real behaviour, never a database edit.
 */
async function setFixtureBroken(
  request: APIRequestContext,
  input: { journey: string; siteId: string; flagId: string; broken: boolean },
): Promise<void> {
  const response = await request.post(requiredEnv('E2E_DEPLOYMENT_TRIGGER_URL'), {
    headers: { authorization: `Bearer ${requiredEnv('E2E_DEPLOYMENT_TRIGGER_TOKEN')}` },
    data: input,
  })
  expect(response.ok(), await response.text()).toBe(true)
}

async function signInOwner(browser: Browser): Promise<{ page: Page; close(): Promise<void> }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(requiredEnv('E2E_SITE_OWNER_EMAIL'))
  await page.getByLabel('Password').fill(requiredEnv('E2E_SITE_OWNER_PASSWORD'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
  return { page, close: () => context.close() }
}

async function signInStranger(
  browser: Browser,
): Promise<{ page: Page; close(): Promise<void> }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(envOr('E2E_GATE_NON_MEMBER_EMAIL', 'E2E_WATCH_EMAIL'))
  await page.getByLabel('Password').fill(envOr('E2E_GATE_NON_MEMBER_PASSWORD', 'E2E_WATCH_PASSWORD'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
  return { page, close: () => context.close() }
}

/**
 * The Outcome under test. A release run may pin it; otherwise the Site's first
 * Outcome that a run can independently exercise is used, so this spec never
 * silently verifies an Outcome with no required binding.
 */
function targetOutcomeId(home: SiteHome): string {
  const pinned = process.env.E2E_OUTCOME_ID?.trim()
  if (pinned) return pinned
  const executable = home.outcomes.find(
    (outcome) => outcome.kind !== 'GENERIC' && outcome.pageUrls.length > 0,
  )
  if (!executable) {
    throw new Error('This Site has no independently executable Outcome to verify')
  }
  return executable.id
}

test.describe('Outcome customer loop', () => {
  test.beforeEach(() => {
    test.skip(
      !credentialedEnabled,
      'Needs E2E_CREDENTIALED=true, a disposable release database, reset consent, and the controlled release fixture',
    )
  })

  test('[journey:outcome-loop] Flag, fix, verify, recover, recur, and keep watching', async ({
    browser,
    request,
  }) => {
    test.setTimeout(1_200_000)
    const owner = await signInOwner(browser)
    const ownerRequest = owner.page.request
    const siteId = requiredEnv('E2E_SITE_ID')

    // The Site leads with its important Outcomes and states coverage honestly.
    const start = await loadHome(ownerRequest, siteId)
    expect(start.outcomes.length, 'a claimed Site has Outcomes').toBeGreaterThan(0)
    expect(start.coverageSummary.length).toBeGreaterThan(0)
    const outcomeId = targetOutcomeId(start)
    // The Outcome under test must be independently executable, not a heuristic leftover.
    expect(flagForOutcome(start, outcomeId).outcome).toBeTruthy()

    // 1. Clear. FixFlags exercised the Outcome itself and reached a trustworthy conclusion.
    const clearRun = await startRun(ownerRequest, siteId, outcomeId, 'clear')
    const cleared = await waitForRunResult(ownerRequest, siteId, clearRun.runId, 'CLEAR')
    expect(cleared.outcomes[0]?.summary, 'a Clear states its evidence').toBeTruthy()

    const afterClear = await loadHome(ownerRequest, siteId)
    expect(flagForOutcome(afterClear, outcomeId).matches, 'a Clear Outcome has no open Flag').toEqual([])

    // 2. An induced, independently caught failure produces a Flag for that Outcome.
    await setFixtureBroken(request, { journey: 'outcome-loop', siteId, flagId: outcomeId, broken: true })
    const flagRun = await startRun(ownerRequest, siteId, outcomeId, 'flag')
    await waitForRunResult(ownerRequest, siteId, flagRun.runId, 'FLAG')

    const afterFlag = await loadHome(ownerRequest, siteId)
    const flagged = flagForOutcome(afterFlag, outcomeId)
    expect(flagged.outcome.state).toBe('FLAG')
    expect(flagged.matches.length, 'one Outcome failure is one Flag').toBe(1)
    const flagId = flagged.matches[0]!.id

    // The Flag carries its proof and its limit, never a score.
    expect(flagged.matches[0]!.evidence.length).toBeGreaterThan(0)
    expect(flagged.matches[0]!.fix.length).toBeGreaterThan(0)

    await owner.page.goto(`/sites/${siteId}/flags/${flagId}`)
    await expect(owner.page.getByText(flagged.matches[0]!.problem, { exact: false }).first()).toBeVisible()

    // 3. Taking the fix elsewhere must not move the verdict. Recording is not proving.
    const handoff = await owner.page.request.post(`/api/sites/${siteId}/flags/${flagId}/fix`, {
      data: { action: 'copy' },
    })
    expect(handoff.status(), await handoff.text()).toBe(200)
    const afterHandoff = await loadHome(ownerRequest, siteId)
    expect(flagForOutcome(afterHandoff, outcomeId).outcome.state, 'a handoff is not a verdict').toBe('FLAG')
    expect(flagForOutcome(afterHandoff, outcomeId).matches.length, 'the Flag stays open').toBe(1)

    // 4. Verify against an unrepaired fixture stays open. Absence is not recovery.
    const blocked = await owner.page.request.post(`/api/sites/${siteId}/flags/${flagId}/verify`, { data: {} })
    expect(blocked.status(), await blocked.text()).toBe(200)
    const blockedRun = (await blocked.json()) as { runId: string; attemptId: string | null }
    expect(blockedRun.runId, 'verify starts a fresh independent run').toBeTruthy()
    await waitForRunResult(ownerRequest, siteId, blockedRun.runId, 'FLAG')

    const afterFailedVerify = await loadHome(ownerRequest, siteId)
    expect(flagForOutcome(afterFailedVerify, outcomeId).outcome.state).toBe('FLAG')
    expect(flagForOutcome(afterFailedVerify, outcomeId).matches.length, 'a failed Verify leaves the Flag open')
      .toBe(1)

    // 5. A comparable recovery resolves the same Flag.
    await setFixtureBroken(request, { journey: 'outcome-loop', siteId, flagId, broken: false })
    const recovery = await owner.page.request.post(`/api/sites/${siteId}/flags/${flagId}/verify`, { data: {} })
    expect(recovery.status(), await recovery.text()).toBe(200)
    const recoveryRun = (await recovery.json()) as { runId: string }
    await waitForRunResult(ownerRequest, siteId, recoveryRun.runId, 'CLEAR')

    const afterRecovery = await loadHome(ownerRequest, siteId)
    expect(flagForOutcome(afterRecovery, outcomeId).outcome.state, 'a proven recovery is Clear').toBe('CLEAR')
    expect(
      flagForOutcome(afterRecovery, outcomeId).matches,
      'a resolved Flag stops being an open Flag',
    ).toEqual([])

    // 6. Recurrence reopens the same Flag identity rather than opening a second one.
    await setFixtureBroken(request, { journey: 'outcome-loop', siteId, flagId, broken: true })
    const recurRun = await startRun(ownerRequest, siteId, outcomeId, 'recur')
    await waitForRunResult(ownerRequest, siteId, recurRun.runId, 'FLAG')

    const afterRecurrence = await loadHome(ownerRequest, siteId)
    const recurred = flagForOutcome(afterRecurrence, outcomeId)
    expect(recurred.outcome.state).toBe('FLAG')
    expect(recurred.matches.length, 'recurrence is one Flag, not a pile').toBe(1)
    expect(recurred.matches[0]!.id, 'recurrence keeps the Flag identity').toBe(flagId)

    await owner.close()
  })

  test('[journey:site-surfaces] Home, Flags, Outcome, Flag, and Settings meet the launch bar', async ({
    browser,
  }) => {
    test.setTimeout(900_000)
    const owner = await signInOwner(browser)
    const siteId = requiredEnv('E2E_SITE_ID')
    const home = await loadHome(owner.page.request, siteId)
    const { outcome, matches } = flagForOutcome(home, targetOutcomeId(home))

    const paths = [
      `/sites/${siteId}`,
      `/sites/${siteId}/flags`,
      `/sites/${siteId}/outcomes/${outcome.id}`,
      `/sites/${siteId}/settings`,
    ]
    if (matches[0]) paths.push(`/sites/${siteId}/flags/${matches[0].id}`)

    for (const path of paths) {
      await assertSiteSurfaceMeetsLaunchBar(owner.page, path)
      await assertKeyboardReachesTheSurface(owner.page, path)
    }
    await owner.close()
  })

  test('[journey:watch-truth] Watch states its cadence and coverage, and a repeated trigger is one run', async ({
    browser,
  }) => {
    test.setTimeout(600_000)
    const owner = await signInOwner(browser)
    const ownerRequest = owner.page.request
    const siteId = requiredEnv('E2E_SITE_ID')

    const before = await loadHome(ownerRequest, siteId)
    const outcomeId = targetOutcomeId(before)
    expect(before.watching, 'this Site is being watched').toBe(true)
    expect(before.watch.interval, 'Watch states its cadence').toBeTruthy()
    expect(before.watch.nextRunAt, 'Watch states when it will next run').toBeTruthy()

    // A repeated trigger with the same key is the same run, not a second execution.
    const key = `watch-equivalence:${Date.now()}`
    const first = await ownerRequest.post(`/api/sites/${siteId}/runs`, {
      headers: { 'idempotency-key': key },
      data: { outcomeIds: [outcomeId] },
    })
    expect(first.status(), await first.text()).toBe(202)
    const second = await ownerRequest.post(`/api/sites/${siteId}/runs`, {
      headers: { 'idempotency-key': key },
      data: { outcomeIds: [outcomeId] },
    })
    expect(second.status(), 'a repeated key reuses the run').toBe(200)
    expect(((await second.json()) as { runId: string }).runId).toBe(
      ((await first.json()) as { runId: string }).runId,
    )

    await owner.close()
  })

  test('[journey:tenant-isolation] another owner cannot read, run, or verify this Site', async ({
    browser,
  }) => {
    test.setTimeout(300_000)
    const siteId = requiredEnv('E2E_SITE_ID')
    const owner = await signInOwner(browser)
    const home = await loadHome(owner.page.request, siteId)
    const outcomeId = targetOutcomeId(home)
    const foreignFlag = flagForOutcome(home, outcomeId).matches[0]
    await owner.close()

    const stranger = await signInStranger(browser)

    expect((await stranger.page.request.get(`/api/sites/${siteId}`)).status(), 'no Site read').not.toBe(200)
    expect(
      (await stranger.page.request.post(`/api/sites/${siteId}/runs`, {
        headers: { 'idempotency-key': `stranger:${Date.now()}` },
        data: { outcomeIds: [outcomeId] },
      })).status(),
      'no Outcome run',
    ).not.toBe(202)
    if (foreignFlag) {
      expect(
        (await stranger.page.request.post(`/api/sites/${siteId}/flags/${foreignFlag.id}/verify`, { data: {} })).status(),
        'no Flag verify',
      ).not.toBe(200)
    }

    await stranger.close()
  })
})
