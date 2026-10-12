import type { SiteTestAccount } from '@prisma/client'
import type { Page } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { executionTransaction, executionWrite } from '@/lib/audit/execution-ownership'
import { TaskFailure } from '@/lib/audit/progressive/contracts'
import { accountObservationSchema, needsDisposableTest, safeEvidenceUrl, type AccountIntent, type AccountObservation } from './contracts'
import { flowFingerprint } from './identity'
import { assertAccountPermission, reserveAccount } from './store'
import { verificationSchema } from './inbox'
import { accountLinks, authenticated, explicitAuthError, fillAccountForm, formSubmit, openAccountBrowser, readAccountForm,
  scopedSessionState, type AccountBrowser, type AccountFlow } from './browser'

export type AccountExecution = { projectId: string; auditId: string; intent: AccountIntent; targetUrl: string; deadline: number }
const observation = (kind: AccountObservation['kind'], state: AccountObservation['state'], detail: string, pageUrl: string,
  evidence: AccountObservation['evidence'] = {}): AccountObservation => accountObservationSchema.parse({ kind, state, detail, pageUrl: safeEvidenceUrl(pageUrl), evidence })
const permission = (input: AccountExecution) => executionTransaction(tx => assertAccountPermission(input.projectId, input.intent, tx))
const accountHomeUrl = (value: string, origin: string) => /(?:verify|verification|confirm|activate)/i.test(new URL(value).pathname) ? origin : safeEvidenceUrl(value)
const passwordFor = (account: SiteTestAccount) => decryptSecret(account.encryptedPassword)
const valuesFor = (account: SiteTestAccount) => [account.email, passwordFor(account)]
async function saveSession(account: SiteTestAccount, browser: AccountBrowser) {
  const state = await browser.session.page.context().storageState()
  await executionWrite(tx => tx.siteTestAccount.update({ where: { id: account.id },
    data: { encryptedSession: encryptSecret(JSON.stringify(scopedSessionState(state, account.origin))), lastCheckedAt: new Date() } }))
}
async function navigate(page: Page, url: string, input: AccountExecution) {
  await permission(input)
  if (new URL(url).origin !== new URL(input.targetUrl).origin) throw new Error('Unsupported authentication origin')
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.min(8000, input.deadline - Date.now())) })
}
async function waitForAuth(page: Page) {
  await page.getByRole('button', { name: /^(?:log\s*out|sign\s*out)$/i }).or(page.getByRole('link', { name: /^(?:log\s*out|sign\s*out)$/i }))
    .first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined)
  return authenticated(page)
}
async function login(account: SiteTestAccount, browser: AccountBrowser, input: AccountExecution) {
  if (await authenticated(browser.session.page)) return true
  const loginUrl = account.loginUrl ?? (await accountLinks(browser.session.page, account.origin, 'log.?in|sign.?in'))[0]
  if (!loginUrl) return false
  await navigate(browser.session.page, loginUrl, input)
  const flow = await readAccountForm(browser.session.page, 'login')
  if (!flow || new URL(flow.action).origin !== account.origin || !flow.fields.some(field => field.type === 'password')) return false
  if (!await fillAccountForm(browser.session.page, flow, account.email, passwordFor(account))) return false
  await permission(input); browser.mutation('login', flow.action)
  try { if (!await formSubmit(browser.session.page.locator('form').nth(flow.formIndex))) return false
    return await waitForAuth(browser.session.page)
  } finally { browser.mutation(null) }
}
async function verifyEmail(account: SiteTestAccount, browser: AccountBrowser, input: AccountExecution) {
  const until = Math.min(input.deadline - 10_000, Date.now() + 30_000)
  do {
    await permission(input)
    if (await authenticated(browser.session.page)) return true
    const message = await prisma.siteAccountMessage.findFirst({ where: { accountId: account.id,
      receivedAt: { gte: account.submittedAt ?? account.createdAt }, expiresAt: { gt: new Date() } }, orderBy: { receivedAt: 'desc' } })
    if (message) {
      const verification = verificationSchema.parse(JSON.parse(decryptSecret(message.encryptedVerification)))
      for (const link of verification.links) {
        if (new URL(link).origin !== account.origin) continue
        await permission(input); browser.mutation('verify', link)
        try { await navigate(browser.session.page, link, input); if (await waitForAuth(browser.session.page)) return true }
        finally { browser.mutation(null) }
      }
      if (verification.code) {
        const field = browser.session.page.locator('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i]').first()
        if (await field.isVisible().catch(() => false)) {
          await field.fill(verification.code)
          const form = field.locator('xpath=ancestor::form[1]')
          const endpoint = await form.getAttribute('action')
          await permission(input); browser.mutation('verify', endpoint ?? browser.session.page.url())
          try { if (await formSubmit(form) && await waitForAuth(browser.session.page)) return true }
          finally { browser.mutation(null) }
        }
      }
      // A confirmation may finish without opening an authenticated session.
      if (await login(account, browser, input)) return true
    }
    await browser.session.page.waitForTimeout(1500)
  } while (Date.now() < until)
  return false
}

async function ensureSignedIn(account: SiteTestAccount, input: AccountExecution): Promise<{ browser: AccountBrowser; observations: AccountObservation[]; active: boolean }> {
  const url = account.state === 'ACTIVE' ? account.homeUrl ?? account.loginUrl ?? account.signupUrl : account.signupUrl
  const browser = await openAccountBrowser({ url, origin: account.origin, values: valuesFor(account), deadline: input.deadline,
    permission: () => permission(input), storageState: account.encryptedSession && account.state !== 'DELETING' ? JSON.parse(decryptSecret(account.encryptedSession)) : undefined })
  const observations: AccountObservation[] = []
  try {
    if (await authenticated(browser.session.page) || account.state !== 'RESERVED' && await login(account, browser, input)) {
      if (!['ACTIVE', 'DELETING'].includes(account.state)) {
        await executionWrite(tx => tx.siteTestAccount.update({ where: { id: account.id }, data: { state: 'ACTIVE', signupVerifiedAt: new Date(), homeUrl: accountHomeUrl(browser.session.page.url(), account.origin) } }))
        observations.push(observation('signup', 'verified', 'The reserved test identity reached a signed-in page.', account.signupUrl),
          observation('verification', 'verified', 'Signed-in access was observed for the reserved identity.', account.signupUrl))
      }
      await saveSession(account, browser)
      return { browser, observations, active: true }
    }
    if (account.state === 'ACTIVE' || account.state === 'DELETING' || account.state === 'DELETED') return { browser, observations, active: false }
    if (account.state === 'RESERVED') {
      const flow = await readAccountForm(browser.session.page, 'signup')
      if (!flow || new URL(flow.action).origin !== account.origin || !flow.fields.some(field => field.type === 'password') ||
        !await fillAccountForm(browser.session.page, flow, account.email, passwordFor(account))) {
        observations.push(observation('signup', 'unavailable', 'This signup form needs fields or authentication that FixFlags cannot exercise automatically.', account.signupUrl))
        return { browser, observations, active: false }
      }
      const won = await executionTransaction(async tx => {
        await assertAccountPermission(input.projectId, input.intent, tx)
        return tx.siteTestAccount.updateMany({ where: { id: account.id, state: 'RESERVED', email: account.email },
          data: { state: 'SUBMITTING', submittedAt: new Date(), operationId: `${input.auditId}:signup:${account.id}` } })
      })
      if (won.count !== 1) return { browser, observations: [observation('signup', 'unknown', 'Another check owns this signup attempt.', account.signupUrl)], active: false }
      browser.mutation('signup', flow.action)
      try { if (!await formSubmit(browser.session.page.locator('form').nth(flow.formIndex))) return { browser,
        observations: [observation('signup', 'unknown', 'Signup could not be submitted. The identity is retained for reconciliation.', account.signupUrl)], active: false }
        await waitForAuth(browser.session.page)
      } finally { browser.mutation(null) }
      if (await explicitAuthError(browser.session.page)) return { browser,
        observations: [observation('signup', 'failed', 'The signup form displayed an error after FixFlags submitted its test identity.', account.signupUrl)], active: false }
      await executionWrite(tx => tx.siteTestAccount.updateMany({ where: { id: account.id, state: 'SUBMITTING', email: account.email }, data: { state: 'VERIFYING' } }))
      await saveSession(account, browser)
    }
    const current = await prisma.siteTestAccount.findUniqueOrThrow({ where: { id: account.id } })
    const active = await authenticated(browser.session.page) || await verifyEmail(current, browser, input)
    if (!active) {
      observations.push(observation('verification', 'unknown', 'Signup completion could not be verified. FixFlags will reuse this identity rather than submit another signup.', account.signupUrl))
      await saveSession(account, browser)
      for (const pending of observations) await executionWrite(tx => tx.siteAccountCheckReceipt.upsert({
        where: { auditId_kind_pageUrl: { auditId: input.auditId, kind: pending.kind, pageUrl: pending.pageUrl } }, update: { state: pending.state, detail: pending.detail },
        create: { projectId: input.projectId, auditId: input.auditId, ...pending } }))
      if (current.submittedAt && Date.now() - current.submittedAt.getTime() >= 15 * 60_000) return { browser, observations, active: false }
      throw new TaskFailure('ACCOUNT_VERIFICATION_PENDING', true, 15_000)
    }
    await executionWrite(tx => tx.siteTestAccount.update({ where: { id: account.id }, data: {
      state: 'ACTIVE', signupVerifiedAt: new Date(), homeUrl: accountHomeUrl(browser.session.page.url(), account.origin) } }))
    await saveSession(account, browser)
    observations.push(observation('signup', 'verified', 'The test identity reached a signed-in page after signup.', account.signupUrl),
      observation('verification', 'verified', 'Any required email verification completed before signed-in access was observed.', account.signupUrl))
    return { browser, observations, active: true }
  } catch (error) { await browser.closed(); throw error }
}

async function inspectSignedIn(browser: AccountBrowser, input: AccountExecution) {
  const origin = new URL(input.targetUrl).origin, start = accountHomeUrl(browser.session.page.url(), origin)
  const urls = [...new Set([start, ...await accountLinks(browser.session.page, origin, '.')])]
    .filter(url => !/(?:logout|sign.?out|sign.?in|signup|register|verify|verification|confirm|activate|delete|remove|checkout|payment|invite|download)/i.test(new URL(url).pathname)).slice(0, 8)
  const observations: AccountObservation[] = []
  for (const url of urls) {
    if (input.deadline - Date.now() < 10_000) break
    await permission(input)
    browser.session.resetConsoleForPage?.()
    const errorsBefore = browser.session.consoleErrors.length
    const response = await browser.session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null)
    if (response && response.status() >= 400) { observations.push(observation('signed_in', 'failed', 'The signed-in page returned an unsuccessful response.', url, { context: 'signed-in', httpStatus: response.status() })); continue }
    if (!response || !await authenticated(browser.session.page)) { observations.push(observation('signed_in', 'unknown', 'Signed-in access could not be confirmed for this page.', url, { context: 'signed-in' })); continue }
    await browser.session.page.waitForTimeout(2000)
    if (browser.refused()) { observations.push(observation('signed_in', 'unknown', 'Some page requests were blocked to preserve read-only access. Full signed-in inspection remains unverified.', url, { context: 'signed-in' })); continue }
    let accessibility: number | null = null
    try { const result = await new AxeBuilder({ page: browser.session.page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
      accessibility = result.violations.filter(item => item.impact === 'critical' || item.impact === 'serious').length
    } catch { /* Missing accessibility evidence remains unknown. */ }
    const errors = browser.session.consoleErrors.length - errorsBefore
    const failed = response.status() >= 400 || (accessibility ?? 0) > 0 || errors > 0
    observations.push(observation('signed_in', failed ? 'failed' : accessibility === null ? 'unknown' : 'verified',
      failed ? 'The signed-in page had a response, accessibility, or browser-error problem.' : accessibility === null
        ? 'Signed-in navigation completed, but accessibility inspection was unavailable.' : 'Signed-in navigation and automated accessibility inspection completed without a detected problem.', url,
      { context: 'signed-in', httpStatus: response.status(), accessibilityIssues: accessibility, browserErrors: errors }))
  }
  return observations.length ? observations : [observation('signed_in', 'unknown', 'No signed-in pages could be inspected within this check.', start)]
}

async function deleteAccount(account: SiteTestAccount, input: AccountExecution): Promise<AccountObservation> {
  if (account.purpose === 'retained' && input.intent.mode !== 'cleanup') throw new Error('The reusable account cannot be deleted by a routine check.')
  if (account.state === 'DELETED') return observation('deletion', 'verified', 'The disposable account was previously verified as deleted.', account.signupUrl)
  if (account.state === 'RESERVED') {
    const canceled = await executionTransaction(async tx => {
      await assertAccountPermission(input.projectId, input.intent, tx)
      return tx.siteTestAccount.updateMany({ where: { id: account.id, email: account.email, state: 'RESERVED', submittedAt: null },
        data: { state: 'DELETED', encryptedSession: null, deletionVerifiedAt: null } })
    })
    return canceled.count === 1
      ? observation('deletion', 'verified', 'The reserved test identity was never submitted. No account needed deletion.', account.signupUrl,
        { signupSubmitted: false, cleanup: 'reservation-canceled' })
      : observation('deletion', 'unknown', 'The test identity changed before cleanup. Its account state remains unverified.', account.signupUrl)
  }
  const signed = await ensureSignedIn(account, input)
  if (!signed.active) {
    // An interrupted deletion is reconciled through the same previously working login.
    const rejected = await explicitAuthError(signed.browser.session.page)
    await signed.browser.closed()
    if (account.state === 'DELETING' && rejected) {
      await executionWrite(tx => tx.siteTestAccount.update({ where: { id: account.id }, data: { state: 'DELETED', encryptedSession: null, deletionVerifiedAt: new Date() } }))
      return observation('deletion', 'verified', 'After deletion, the previously working test-account login was rejected.', account.signupUrl)
    }
    return observation('deletion', 'unknown', 'Account deletion could not be tested because signed-in access was unavailable.', account.signupUrl)
  }
  const { browser } = signed
  if (account.state === 'DELETING' && input.intent.mode !== 'cleanup') {
    await browser.closed()
    return observation('deletion', 'unknown', 'The previous deletion attempt remains unverified. FixFlags did not repeat it.', account.signupUrl)
  }
  try {
    const settings = await accountLinks(browser.session.page, account.origin, 'settings|profile|account')
    let control = browser.session.page.getByRole('button', { name: /^(?:delete|close|remove)(?: my| this)? account$/i }).first()
    if (!await control.isVisible().catch(() => false) && settings[0]) { await navigate(browser.session.page, settings[0], input)
      control = browser.session.page.getByRole('button', { name: /^(?:delete|close|remove)(?: my| this)? account$/i }).first() }
    if (!await control.isVisible().catch(() => false)) return observation('deletion', 'unavailable', 'No supported account-deletion control was available. The test account may remain.', browser.session.page.url())
    // A successful, credential-bound login proves which account this isolated context controls.
    if (!await authenticated(browser.session.page)) return observation('deletion', 'unknown', 'Account identity could not be confirmed before deletion.', browser.session.page.url())
    await executionTransaction(async tx => { await assertAccountPermission(input.projectId, input.intent, tx)
      const won = await tx.siteTestAccount.updateMany({ where: { id: account.id, email: account.email, state: { in: ['ACTIVE', 'DELETING'] } },
        data: { state: 'DELETING', operationId: `${input.auditId}:delete:${account.id}` } })
      if (won.count !== 1) throw new Error('Account identity changed before deletion.')
    })
    await permission(input); browser.mutation('delete')
    await control.click()
    const dialog = browser.session.page.getByRole('dialog')
    if (await dialog.isVisible().catch(() => false)) {
      const password = dialog.locator('input[type="password"]').first()
      if (await password.isVisible().catch(() => false)) await password.fill(passwordFor(account))
      const confirmation = dialog.locator('input[type="email"], input[placeholder*="email" i]').first()
      if (await confirmation.isVisible().catch(() => false)) await confirmation.fill(account.email)
      const submit = dialog.getByRole('button', { name: /^(?:delete|close|remove)(?: my| this)? account(?: permanently)?$/i }).first()
      if (await submit.isVisible().catch(() => false)) { await permission(input); await submit.click() }
    }
    await browser.session.page.waitForTimeout(2000)
    browser.mutation(null)
    if (await authenticated(browser.session.page)) return observation('deletion', 'unknown', 'The account remained signed in after the deletion attempt. Deletion is not verified.', account.signupUrl)
  } finally { await browser.closed() }
  // A new context prevents a logout or old cookie from being mistaken for deletion.
  const fresh = await openAccountBrowser({ url: account.loginUrl ?? account.signupUrl, origin: account.origin,
    values: valuesFor(account), deadline: input.deadline, permission: () => permission(input) })
  try {
    if (await login(account, fresh, input)) {
      await executionWrite(tx => tx.siteTestAccount.updateMany({ where: { id: account.id, email: account.email, state: 'DELETING' }, data: { state: 'ACTIVE' } }))
      return observation('deletion', 'failed', 'The test account could still sign in after the deletion attempt.', account.signupUrl)
    }
    if (!await explicitAuthError(fresh.session.page)) return observation('deletion', 'unknown', 'The follow-up login did not establish whether the account was deleted.', account.signupUrl)
    await executionWrite(tx => tx.siteTestAccount.update({ where: { id: account.id }, data: { state: 'DELETED', encryptedSession: null, deletionVerifiedAt: new Date() } }))
    return observation('deletion', 'verified', 'The previously working test-account login was rejected in a fresh session after deletion.', account.signupUrl)
  } finally { await fresh.closed() }
}

export async function executeAccountChecks(input: AccountExecution): Promise<{ observations: AccountObservation[] }> {
  await permission(input)
  await executionWrite(tx => tx.siteAccountMessage.deleteMany({ where: { account: { projectId: input.projectId }, expiresAt: { lte: new Date() } } }))
  const origin = new URL(input.targetUrl).origin
  if (new URL(input.targetUrl).protocol !== 'https:') return { observations: [observation('signup', 'unavailable', 'Automatic account checks require HTTPS.', input.targetUrl)] }
  if (input.intent.mode === 'cleanup') {
    const accounts = await prisma.siteTestAccount.findMany({ where: { projectId: input.projectId, origin, state: { not: 'DELETED' } }, take: 2 })
    const observations: AccountObservation[] = []
    for (const account of accounts) observations.push(await deleteAccount(account, input))
    if (observations.length > 1) {
      const rank = { failed: 0, unknown: 1, unavailable: 2, verified: 3 }
      const worst = observations.toSorted((a, b) => rank[a.state] - rank[b.state])[0]
      return { observations: [observation('deletion', worst.state, `${observations.filter(item => item.state === 'verified').length} of ${observations.length} test accounts were verified as deleted. ${worst.detail}`, input.targetUrl)] }
    }
    return { observations: observations.length ? observations : [observation('deletion', 'unavailable', 'There are no active FixFlags test accounts to delete.', input.targetUrl)] }
  }
  const discovery = await openAccountBrowser({ url: input.targetUrl, origin, values: [], deadline: input.deadline, permission: () => permission(input) })
  let signupLimitation = 'No supported email/password signup form was discovered.'
  let flow: AccountFlow | null = null, signupUrl: string | undefined, loginUrl: string | null = null
  try {
    loginUrl = (await accountLinks(discovery.session.page, origin, 'log.?in|sign.?in'))[0] ?? null
    signupUrl = (await accountLinks(discovery.session.page, origin, 'sign.?up|register|registration|create.?account'))[0]
    if (!signupUrl) {
      const inline = await readAccountForm(discovery.session.page, 'signup')
      if (inline?.fields.some(field => field.autocomplete === 'new-password') || /signup|register/i.test(new URL(input.targetUrl).pathname)) signupUrl = input.targetUrl
    }
    if (signupUrl) {
      await navigate(discovery.session.page, signupUrl, input)
      if (await discovery.session.page.locator('[data-sitekey], iframe[src*="captcha" i], input[name="g-recaptcha-response"]').count())
        signupLimitation = 'Signup requires a CAPTCHA. FixFlags did not submit the form or bypass the challenge.'
      else flow = await readAccountForm(discovery.session.page, 'signup')
    }
  } finally { await discovery.closed() }
  if (!signupUrl || !flow) {
    const existing = await prisma.siteTestAccount.findUnique({ where: { projectId_origin_purpose: { projectId: input.projectId, origin, purpose: 'retained' } } })
    const observations = [observation('signup', 'unavailable', signupLimitation, input.targetUrl)]
    if (existing?.state === 'ACTIVE') {
      const signed = await ensureSignedIn(existing, input)
      try { if (signed.active) observations.push(...await inspectSignedIn(signed.browser, input))
        else observations.push(observation('signed_in', 'unknown', 'The retained test account could not sign in. No replacement was created.', existing.signupUrl))
      } finally { await signed.browser.closed() }
    }
    return { observations }
  }
  const fingerprint = flowFingerprint(flow)
  const retained = await reserveAccount({ projectId: input.projectId, origin, purpose: 'retained', signupUrl, loginUrl, fingerprint, intent: input.intent })
  if (retained.state === 'DELETED') return { observations: [observation('signed_in', 'unavailable', 'The retained FixFlags account was deleted. Account checks remain paused until enabled again.', signupUrl)] }
  const signed = await ensureSignedIn(retained, input), observations = [...signed.observations]
  try {
    if (!signed.active) { observations.push(observation('signed_in', 'unknown', 'The retained test account could not sign in. FixFlags did not create a replacement.', signupUrl)); return { observations } }
    observations.push(...await inspectSignedIn(signed.browser, input)); await saveSession(retained, signed.browser)
  } finally { await signed.browser.closed() }
  const previous = await prisma.siteTestAccount.findUnique({ where: { projectId_origin_purpose: { projectId: input.projectId, origin, purpose: 'disposable' } } })
  if (!needsDisposableTest({ mode: input.intent.mode, fingerprint, previousFingerprint: previous?.flowFingerprint, state: previous?.state })) {
    if (previous && previous.state !== 'DELETED') observations.push(await deleteAccount(previous, input))
    return { observations }
  }
  const disposable = await reserveAccount({ projectId: input.projectId, origin, purpose: 'disposable', signupUrl, loginUrl, fingerprint,
    intent: input.intent, replaceDeleted: true })
  const tested = await ensureSignedIn(disposable, input)
  observations.push(...tested.observations)
  await tested.browser.closed()
  if (tested.active) observations.push(await deleteAccount(await prisma.siteTestAccount.findUniqueOrThrow({ where: { id: disposable.id } }), input))
  return { observations }
}
