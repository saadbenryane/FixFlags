import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import { AUTH } from '../lib/marketing/copy/auth'
import { PUBLIC_SITE_COPY } from '../lib/marketing/copy/public-site'
import { SITE_DASHBOARD_COPY } from '../lib/marketing/copy/site-dashboard'
import type { SiteHomeView } from '../lib/sites/application/queries'

test.use({ actionTimeout: 15_000 })

test('anonymous evidence survives ordinary sign-in and becomes private owner evidence', async ({ page, browser, baseURL }) => {
  test.skip(process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1', 'Explicit isolated local proof only')
  test.setTimeout(240_000)
  loadEnvConfig(process.cwd())
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local app required')
  const database = new URL(process.env.DATABASE_URL!)
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || !/^\/fixflags_category_journey_[a-f0-9]+$/.test(database.pathname)) throw new Error('Disposable journey database required')
  const runtime = JSON.parse(await readFile('.cache/customer-reliability-runtime.json', 'utf8'))
  const db = new PrismaClient()
  const nonce = randomBytes(8).toString('hex')
  const email = `reliability-${nonce}@example.invalid`
  const password = `Ff!${randomBytes(18).toString('base64url')}`
  // Only the existing account is seeded. Admission, creator cookies, sign-in,
  // claim, reading position and evidence access use ordinary application paths.
  const user = await db.user.create({ data: { email, name: 'Claim fixture', emailVerified: true } })
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(password) } })
  try {
    const configured = await page.request.post(`${runtime.fixtureOrigin}/control`, {
      headers: { Authorization: `Bearer ${runtime.token}` }, data: { fixtureEnabled: true, broken: false },
    })
    expect(configured.ok()).toBe(true)
    await page.goto('/new')
    const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.getByLabel('Website URL').first().fill(`https://example.com${runtime.prefix}`)
    await page.getByRole('button', { name: PUBLIC_SITE_COPY.analyze, exact: true }).first().click()
    await page.waitForURL(/\/sites\//)
    const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    // Native browser fetch retains the Secure creator cookie on trusted loopback.
    const home = () => page.evaluate(async id => {
      const response = await fetch(`/api/sites/${id}`, { cache: 'no-store' })
      return { status: response.status, body: await response.json() as SiteHomeView }
    }, siteId)
    await expect.poll(async () => {
      const response = await home()
      return response.status === 200 ? response.body.audit?.status : `HTTP ${response.status}`
    }, { timeout: 150_000, intervals: [1000] }).toBe('COMPLETED')
    const original = (await home()).body
    expect(original.site.userId).toBeNull()
    const originalAuditId = original.audit?.id
    if (!originalAuditId) throw new Error('Anonymous check has no completed report')
    const findings = (view: SiteHomeView) => view.flags.map(flag => ({
      sourceFlagId: flag.sourceFlagId ?? flag.id, checkId: flag.checkId, problem: flag.problem,
    }))
    const originalFindings = findings(original)
    expect(originalFindings.length).toBeGreaterThan(0)
    const capture = original.captures?.find(item => item.device === 'desktop')
    if (!capture) throw new Error('Anonymous check has no desktop evidence')
    const captureHash = (url: string) => page.evaluate(async path => {
      const response = await fetch(path, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Capture returned HTTP ${response.status}`)
      const bytes = await response.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      return { bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') }
    }, url)
    const beforeCapture = await captureHash(capture.url)
    expect(beforeCapture.bytes).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Open Search', exact: true }).click()
    const category = page.getByRole('dialog')
    await category.locator('summary').filter({ hasText: SITE_DASHBOARD_COPY.checkDetails }).click()
    const continuation = category.getByRole('button', { name: /^Check(?: Search)? again$/ }).last()
    await continuation.scrollIntoViewIfNeeded()
    await continuation.focus()
    const position = await category.evaluate(node => ({ top: node.querySelector('[data-dialog-scroll]')!.scrollTop, y: scrollY, destination: location.pathname + location.search + location.hash }))
    await continuation.click()
    const authentication = page.getByRole('dialog').filter({ has: page.getByLabel('Email') })
    await expect(authentication).toBeVisible()
    await authentication.getByRole('button', { name: AUTH.signUp.footerLink, exact: true }).click()
    await authentication.getByLabel('Email').fill(email)
    await authentication.getByLabel('Password', { exact: true }).fill(password)
    await authentication.getByRole('button', { name: AUTH.signIn.cta, exact: true }).click()
    await page.waitForURL(url => url.pathname === `/sites/${siteId}` && url.searchParams.get('category') === 'search')
    const returnedCategory = page.getByRole('dialog')
    await expect(returnedCategory.getByRole('heading', { name: 'Search', exact: true })).toBeVisible()
    const returnedContext = await returnedCategory.evaluate(node => ({ top: node.querySelector('[data-dialog-scroll]')!.scrollTop, y: scrollY,
      focusInside: node.contains(document.activeElement), disclosures: [...node.querySelectorAll('details')].map(details => ({ summary: details.querySelector('summary')?.textContent, open: details.open })) }))
    await test.info().attach('claim-reading-context', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ before: position, returned: returnedContext })) })
    await expect.poll(() => returnedCategory.locator('summary').filter({ hasText: SITE_DASHBOARD_COPY.checkDetails })
      .evaluate(summary => (summary.parentElement as HTMLDetailsElement).open)).toBe(true)
    await expect.poll(() => returnedCategory.evaluate((node, before) =>
      node.contains(document.activeElement) && Math.abs(node.querySelector('[data-dialog-scroll]')!.scrollTop - before.top) <= 1 && Math.abs(scrollY - before.y) <= 1, position), { timeout: 6000 }).toBe(true)
    expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash).toBe(position.destination)
    const claimed = (await home()).body
    expect(claimed.site.userId).toBe(user.id)
    const retained = await db.audit.findUniqueOrThrow({ where: { id: originalAuditId }, select: { userId: true, projectId: true } })
    expect(retained.userId).toBe(user.id)
    expect(retained.projectId).toBe(claimed.site.projectId)
    expect(findings(claimed)).toEqual(expect.arrayContaining(originalFindings))
    expect(claimed.monitoringHistory).toEqual(expect.arrayContaining([expect.objectContaining({ id: originalAuditId })]))
    expect(claimed.monitoringTrend).toEqual(expect.arrayContaining([expect.objectContaining({ id: originalAuditId })]))
    expect(await captureHash(capture.url)).toEqual(beforeCapture)
    const stranger = await browser.newContext()
    try {
      const response = await stranger.request.get(new URL(capture.url, baseURL).toString())
      expect([401, 403, 404]).toContain(response.status())
    } finally { await stranger.close() }
    await test.info().attach('ordinary-sign-in-claim', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      scope: 'Disposable local database, real production web, queue, worker and Chromium; controlled website and storage transports. Existing verified fixture account, no signup or email delivery claim.',
      originalAuditId, originalSiteId: siteId, canonicalProjectId: claimed.site.projectId,
      sameAuditOwned: true, originalFindings, historyAndTrendRetained: true, originalCapture: beforeCapture,
      restoredCategoryAndReadingPosition: true, strangerCaptureDenied: true,
    })) })
  } finally { await db.$disconnect() }
})
