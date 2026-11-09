import { expect, type Page } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import { AUTH } from '../../lib/marketing/copy/auth'
import { NOTIFICATION_EMAIL_COPY } from '../../lib/marketing/copy/notification-emails'

type Message = { to: string | string[]; subject: string; text: string }

export async function verifyClaimSignup(input: {
  page: Page; db: PrismaClient; email: string; password: string; origin: string
  messages: () => Promise<Message[]>; stillAnonymous: () => Promise<void>
}) {
  const { page, db, email, password, origin } = input
  const authentication = page.getByRole('dialog').filter({ has: page.getByLabel('Email') })
  await expect(authentication).toBeVisible()
  await authentication.getByLabel('Email').fill(email)
  await authentication.getByLabel('Password', { exact: true }).fill(password)
  await authentication.getByRole('button', { name: AUTH.signUp.cta, exact: true }).click()
  await expect(page.getByRole('status', { name: AUTH.emailVerification.title })).toBeVisible()
  const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, emailVerified: true } })
  expect(user.emailVerified).toBe(false)
  expect(await db.session.count({ where: { userId: user.id } })).toBe(0)
  await input.stillAnonymous()
  const verificationMessages = async () => (await input.messages()).filter(message =>
    message.subject === NOTIFICATION_EMAIL_COPY.verification.subject &&
    (Array.isArray(message.to) ? message.to.includes(email) : message.to === email))
  await expect.poll(async () => (await verificationMessages()).length).toBe(1)
  await page.getByRole('button', { name: AUTH.emailVerification.resend, exact: true }).click()
  await expect(page.getByText(AUTH.emailVerification.resent, { exact: true })).toBeVisible()
  await expect.poll(async () => (await verificationMessages()).length).toBe(2)
  const [, resent] = await verificationMessages()
  const link = resent.text.match(/https?:\/\/\S+/)?.[0]
  if (!link) throw new Error('Controlled verification email had no link')
  const verificationUrl = new URL(link)
  expect(verificationUrl.origin).toBe(origin)
  expect(verificationUrl.pathname).toBe('/api/auth/verify-email')
  expect(verificationUrl.searchParams.has('token')).toBe(true)
  const handoff = page.waitForURL(url => url.pathname === '/post-login')
  await page.goto(verificationUrl.href)
  await handoff
  return user.id
}
