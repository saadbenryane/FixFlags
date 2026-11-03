import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { AUTH } from '../lib/marketing/copy/auth'
import { APP_NAV_COPY } from '../lib/marketing/copy/navigation'

test('Settings retains Back/Forward drafts, deliberately discards both forms and saves through the real API', async ({ page, baseURL }) => {
  test.skip(process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1', 'Explicit isolated local acceptance only')
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local app required')
  const database = new URL(process.env.DATABASE_URL!)
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || !/^\/fixflags_category_journey_[a-f0-9]+$/.test(database.pathname))
    throw new Error('Disposable journey database required')
  const db = new PrismaClient(), nonce = randomBytes(8).toString('hex')
  const email = `settings-${nonce}@example.invalid`, password = `Ff!${randomBytes(18).toString('base64url')}`
  const originalName = 'Settings fixture', ac = AUTH.settings.account
  const user = await db.user.create({ data: { email, name: originalName, emailVerified: true } })
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(password) } })
  try {
    expect((await page.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email, password } })).ok()).toBe(true)
    await page.goto('/dashboard')
    const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
    if (await consent.isVisible()) await consent.click()
    const account = () => page.getByRole('link', { name: APP_NAV_COPY.account, exact: true })
    await account().click()
    await expect(page).toHaveURL(/\/settings$/)
    const name = page.getByRole('textbox', { name: ac.nameLabel })
    const summary = page.getByLabel('Website summary')
    await name.fill('Retained draft')
    await summary.selectOption('OFF')
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goForward()
    await expect(name).toHaveValue('Retained draft')
    await expect(summary).toHaveValue('OFF')

    const websites = () => page.getByRole('link', { name: 'Websites', exact: true }).first()
    await websites().click()
    const confirmation = page.getByRole('dialog', { name: ac.unsavedTitle })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: ac.unsavedStay, exact: true }).click()
    await expect(name).toHaveValue('Retained draft')
    await expect(summary).toHaveValue('OFF')
    await websites().click()
    await confirmation.getByRole('button', { name: ac.unsavedLeave, exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await account().click()
    await expect(name).toHaveValue(originalName)
    await expect(summary).toHaveValue('FOLLOW_MONITORING')

    await name.fill('Saved fixture')
    await page.getByRole('button', { name: ac.saveCta, exact: true }).click()
    await expect(page.getByRole('button', { name: ac.saveCta, exact: true })).toBeDisabled()
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } })).name).toBe('Saved fixture')
    await page.reload()
    await expect(name).toHaveValue('Saved fixture')
    await summary.selectOption('OFF')
    await page.getByRole('button', { name: 'Save email preferences', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Email preferences saved.' })).toBeVisible()
    await page.reload()
    await expect(summary).toHaveValue('OFF')
  } finally { await db.$disconnect() }
})
