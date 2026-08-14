#!/usr/bin/env tsx

import { randomBytes } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { scanLimitForPlan, deepReviewLimitForPlan } from '../lib/billing/plans'
import { generateApiKey } from '../lib/security/api-keys'
import {
  assertNonProductionReleaseTarget,
  canonicalReleaseDatabaseIdentity,
  releaseDatabaseIdentityHash,
  RELEASE_FIXTURE_ROLES,
} from '../lib/release/fixture-contract'

export type ReleaseFixtureConfig = {
  runId: string
  gitSha: string
  targetOrigin: string
  databaseUrl: string
  manifestPath: string
  auditUrl: string
}

export function canonicalDatabaseIdentity(databaseUrl: string): string {
  return canonicalReleaseDatabaseIdentity(databaseUrl)
}

export function databaseIdentityHash(databaseUrl: string): string {
  return releaseDatabaseIdentityHash(databaseUrl)
}

export function readReleaseFixtureConfig(env = process.env): ReleaseFixtureConfig {
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`${name} is required`)
    return value
  }
  const targetOrigin = assertNonProductionReleaseTarget(required('E2E_BASE_URL'))
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  return {
    runId: required('RELEASE_RUN_ID'),
    gitSha,
    targetOrigin,
    databaseUrl: required('RELEASE_FRESH_DATABASE_URL'),
    manifestPath: path.resolve(required('RELEASE_FIXTURE_MANIFEST')),
    auditUrl: required('E2E_AUDIT_URL'),
  }
}

function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const setCookies = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
  return setCookies.map((cookie) => cookie.split(';', 1)[0]).filter(Boolean).join('; ')
}

async function signIn(origin: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Fixture authentication failed for ${email} (${response.status})`)
  const cookie = cookieHeader(response)
  if (!cookie) throw new Error(`Fixture authentication returned no session for ${email}`)
  return cookie
}

async function createRealReview(origin: string, cookie: string, url: string): Promise<string> {
  const created = await fetch(`${origin}/api/checks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ url, mode: 'single', source: 'release_fixture' }),
  })
  if (!created.ok) throw new Error(`Fixture Review creation failed (${created.status}): ${await created.text()}`)
  const reportId = String((await created.json() as { reportId?: string }).reportId ?? '')
  if (!reportId) throw new Error('Fixture Review creation returned no reportId')
  const deadline = Date.now() + 360_000
  while (Date.now() < deadline) {
    const status = await fetch(`${origin}/api/reports/${reportId}/status`, { headers: { cookie } })
    if (!status.ok) throw new Error(`Fixture Review status failed (${status.status})`)
    const body = await status.json() as { status?: string; errorMsg?: string }
    if (body.status === 'COMPLETED') return reportId
    if (body.status === 'FAILED') throw new Error(`Fixture Review failed: ${body.errorMsg ?? 'unknown error'}`)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`Fixture Review ${reportId} did not complete`)
}

async function main() {
  const config = readReleaseFixtureConfig()
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })
  const fixtureEntries: Record<string, Record<string, unknown>> = {}
  try {
    for (const role of RELEASE_FIXTURE_ROLES) {
      const email = `release-${config.runId}-${role.key.toLowerCase()}@example.test`
      const password = `Ff!${randomBytes(18).toString('base64url')}`
      const passwordHash = await hashPassword(password)
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: `Release ${role.key}`,
          emailVerified: true,
          plan: role.plan,
          subscriptionStatus: role.subscriptionStatus,
          auditsLimit: scanLimitForPlan(role.plan),
          deepReviewsLimit: deepReviewLimitForPlan(role.plan),
        },
        update: {
          plan: role.plan,
          subscriptionStatus: role.subscriptionStatus,
          emailVerified: true,
          auditsLimit: scanLimitForPlan(role.plan),
          deepReviewsLimit: deepReviewLimitForPlan(role.plan),
        },
      })
      await prisma.account.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: email } },
        create: { userId: user.id, providerId: 'credential', accountId: email, password: passwordHash },
        update: { userId: user.id, password: passwordHash },
      })
      fixtureEntries[role.key] = { userId: user.id, email, password, plan: role.plan }
    }

    for (const [key, batch] of [['waitlistReleased', 1], ['waitlistBlocked', 2]] as const) {
      const fixture = fixtureEntries[key]!
      const entry = await prisma.paidPlanWaitlistEntry.upsert({
        where: { userId_plan: { userId: String(fixture.userId), plan: 'BUILDER' } },
        create: {
          userId: String(fixture.userId), plan: 'BUILDER', email: String(fixture.email),
          source: 'release_fixture', campaign: config.runId, batch,
          discountTier: batch, accessGrantedAt: batch === 1 ? new Date() : null,
        },
        update: { batch, discountTier: batch, accessGrantedAt: batch === 1 ? new Date() : null },
      })
      fixture.entryId = entry.id
    }

    const pro = fixtureEntries.pro!
    const generated = generateApiKey()
    await prisma.apiKey.upsert({
      where: { keyHash: generated.keyHash },
      create: {
        userId: String(pro.userId), name: `Release ${config.runId}`, keyHash: generated.keyHash,
        prefix: generated.prefix, lastFour: generated.lastFour, client: 'other',
      },
      update: { revokedAt: null },
    })
    pro.apiKey = generated.rawKey

    for (const key of ['free', 'pro', 'studio', 'share', 'watch'] as const) {
      const fixture = fixtureEntries[key]!
      const cookie = await signIn(config.targetOrigin, String(fixture.email), String(fixture.password))
      fixture.reportId = await createRealReview(config.targetOrigin, cookie, config.auditUrl)
      const audit = await prisma.audit.findUnique({
        where: { id: String(fixture.reportId) },
        select: { projectId: true },
      })
      if (!audit?.projectId) throw new Error(`Fixture Review ${fixture.reportId} has no Product`)
      fixture.projectId = audit.projectId
    }

    const manifest = {
      schemaVersion: 1,
      runId: config.runId,
      gitSha: config.gitSha,
      targetOrigin: config.targetOrigin,
      databaseIdentityHash: databaseIdentityHash(config.databaseUrl),
      createdAt: new Date().toISOString(),
      fixtures: fixtureEntries,
      externalRequired: ['stripe-active', 'stripe-revoked', 'github-oauth', 'mailbox', 'webauthn'],
    }
    await mkdir(path.dirname(config.manifestPath), { recursive: true, mode: 0o700 })
    await writeFile(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
    await chmod(config.manifestPath, 0o600)
    console.log(`Release fixture manifest ready: ${path.basename(config.manifestPath)}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
