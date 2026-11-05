import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { recordFlagImprovementAttempt } from './attempts'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { readRepairSources } from '@/lib/sites/domain/repair-source'
import { writeProjectAccessGrant } from '@/lib/audit/scan-access-grants'
import { admitScanAccess } from '@/lib/audit/scan-access-store'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import * as publicUrls from '@/lib/audit/url'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('retained Site repair authority', () => {
  let users: string[], projects: string[]
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    users = []; projects = []
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { projectId: { in: projects } } })
    await prisma.project.deleteMany({ where: { id: { in: projects } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
  })

  it.each([false, true].flatMap(linked => [false, true].map(erased => ({ linked, erased })) ))(
    'keeps an original finding repairable after transfer (linked=$linked, original actor erased=$erased)', async ({ linked, erased }) => {
      for (const actor of ['original', 'current']) users.push((await prisma.user.create({ data: {
        email: actor + '-' + randomUUID() + '@retained-repair.example',
      } })).id)
      const oldOwner = users[0], currentOwner = users[1], url = 'https://example.com/'
      const grant = writeProjectAccessGrant({ headers: { 'X-Private-Preview': 'previous-owner-fixture-secret' } }, url)
      const site = await prisma.project.create({ data: { userId: oldOwner, canonicalHost: 'example.com', url,
        name: 'Retained Site', scanAccessEncrypted: grant.payload, scanAccessAuthorizedByUserId: oldOwner,
        notificationLevel: 'OFF', accountChecksEnabled: false } })
      projects.push(site.id)
      const audit = await prisma.audit.create({ data: { userId: oldOwner, projectId: site.id, url, isPublic: false,
        status: 'COMPLETED', completedAt: new Date() } })
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'buttons-no-text', pageUrl: url,
        rubric: 'TRUST', severity: 'IMPORTANT', problem: 'The recorded control has no name', evidence: 'The source button has no accessible name',
        whyItMatters: 'Its purpose is unavailable by name', fix: 'Name the original control', confidence: 1, position: 0 } })
      const originalAttempt = linked ? await recordSiteFlagFix({ siteId: site.id, flagId: flag.id, userId: oldOwner,
        idempotencyKey: 'original-owner-key', changeSummary: 'Restore the original control name' }) : null
      const originalIdentity = await prisma.improvementOccurrence.findUnique({ where: { flagId: flag.id } })
      const originalEvents = await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId: site.id } }, orderBy: { id: 'asc' } })
      await prisma.project.update({ where: { id: site.id }, data: { userId: currentOwner } })
      if (erased) await prisma.user.delete({ where: { id: oldOwner } })
      const retainedAudit = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      expect(retainedAudit.userId).toBe(erased ? null : oldOwner)
      expect(await admitScanAccess(prisma, { projectId: site.id, userId: currentOwner, targetUrl: url }))
        .toEqual({ config: null, intent: { kind: 'public', origin: 'https://example.com' } })
      const current = (await loadSiteRecord(site.id))!
      expect((await loadSiteFlagDetail(current, flag.id))?.sourceFlagId).toBe(flag.id)
      await expect(recordFlagImprovementAttempt({ flagId: flag.id, userId: oldOwner, builder: 'former-owner', action: 'HANDOFF_COPIED' }))
        .rejects.toThrow('Flag is not attached to an owned Product')
      const command = { siteId: site.id, flagId: flag.id, userId: currentOwner, idempotencyKey: 'current-owner-repair',
        changeSummary: 'Restore the original control name' }
      if (originalAttempt) await expect(recordSiteFlagFix({ ...command, idempotencyKey: 'original-owner-key' }))
        .rejects.toMatchObject({ status: 409, code: 'FIX_INTENT_MISMATCH' })
      const fixed = await recordSiteFlagFix(command)
      const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })
      expect(readRepairSources(attempt.sourceObservations)?.flags).toMatchObject([{ id: flag.id, auditId: audit.id, pageUrl: url }])
      const identity = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      if (originalIdentity) expect(identity).toEqual(originalIdentity)
      expect(await prisma.improvement.count({ where: { projectId: site.id } })).toBe(1)
      expect((await recordSiteFlagFix(command)).attemptId).toBe(fixed.attemptId)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toEqual(attempt)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(retainedAudit)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toEqual(flag)
      expect(await prisma.improvementCycleEvent.findMany({ where: { id: { in: originalEvents.map(event => event.id) } }, orderBy: { id: 'asc' } }))
        .toEqual(originalEvents)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
        userId: currentOwner, scanAccessEncrypted: grant.payload, scanAccessAuthorizedByUserId: erased ? null : oldOwner,
      })
    })

  it.each(['another-site', 'former-owner'] as const)('refuses parent admission scoped through %s without creating work', async boundary => {
    for (const actor of ['original', 'current']) users.push((await prisma.user.create({ data: {
      email: actor + '-' + randomUUID() + '@retained-parent.example',
    } })).id)
    const url = 'https://example.com/'
    for (const name of ['requested', 'other']) projects.push((await prisma.project.create({ data: {
      userId: users[1], name, canonicalHost: name === 'requested' ? 'example.com' : 'other.example.com',
      url: name === 'requested' ? url : 'https://other.example.com/',
    } })).id)
    const actor = boundary === 'former-owner' ? users[0] : users[1]
    const audit = await prisma.audit.create({ data: { userId: actor, projectId: projects[boundary === 'another-site' ? 1 : 0],
      url, status: 'COMPLETED', completedAt: new Date(), isPublic: false } })
    // This fixture exercises parent authority. Native URL collection is tested separately.
    vi.spyOn(publicUrls, 'assertPublicNavigationUrl').mockResolvedValue(new URL(url))
    await expect(createAndEnqueueAudit({ userId: actor, url, admission: { kind: 'site-run', parentId: audit.id,
      request: { id: randomUUID(), projectId: projects[0], requestedByUserId: actor, source: 'WEB', idempotencyKey: 'forbidden-parent' },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
        checks: {}, outcomes: [], verificationTarget: null } } })).rejects.toMatchObject({ name: 'ParentAuditError', status: 404 })
    expect(await prisma.audit.count({ where: { projectId: { in: projects } } })).toBe(1)
    expect(await prisma.runRequest.count({ where: { projectId: { in: projects } } })).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
  })
})
