import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '../ensure-site'
import { loadSiteFlagDetail, loadSiteFindings, loadSiteResolvedFlags } from '../flags'
import { buildSiteRepairBrief } from '../repair-brief'
import { loadSiteFlagCopyTask } from '../application/flag-copy-task'
import { loadSiteFixBundle } from '../application/fix-bundle'
import { ensureOwnedFlagIdentities, ownedFlagIdentityInclude } from '@/lib/improvements/owned-flag-identity'
import { uploadScreenshot, deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { loadSiteRepairEvidence } from '../application/repair-evidence'
import { pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { recordSiteFlagFix } from '../application/flag-verification'
import { buildExecutionSpec } from '../application/execution-spec'
import { verificationSourceAuditId } from '../domain/verification-source'
import * as screenshots from '@/lib/storage/screenshots'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('persisted repair context scope', () => {
  const owner = 'repair-context-' + randomUUID()
  let siteId: string, incidentId: string
  const captures: Array<{ id: string; auditId: string }> = []
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    siteId = (await prisma.project.create({ data: { userId: owner, canonicalHost: 'repair-context.test',
      url: 'https://repair-context.test/', name: 'Repair context fixture', watchInterval: null } })).id
    for (let index = 0; index < 2; index++) {
      const pageUrl = `https://repair-context.test/page-${index}`
      const audit = await prisma.audit.create({ data: { userId: owner, projectId: siteId, url: pageUrl,
        status: 'COMPLETED', completedAt: new Date(), includeAi: false } })
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
        fingerprint: 'repair-context-buttons', rubric: 'EXPERIENCE', severity: 'IMPORTANT', pageUrl, affectedPaths: [pageUrl],
        problem: 'Buttons must have discernible text', evidence: `Recorded unnamed control on page ${index}`,
        whyItMatters: 'The control purpose is unavailable', fix: 'Name the existing control', confidence: 1, position: 0,
        supportingObservations: { version: 1, items: Array.from({ length: 35 }, (_, item) => ({
          source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl,
          evidence: `Page ${index}, unnamed control ${item}`, verificationRule: 'Control has an accessible name',
          evidenceTargets: [{ source: 'measured', kind: 'element', device: index ? 'mobile' : 'desktop',
            label: 'Control', selector: `#control-${item}`, context: 'private comparison input' }],
          provenance: { auditId: audit.id, taskId: 'recorded-task-' + index, collectedAt: new Date().toISOString() },
        })) } } })
      captures.push({ id: flag.id, auditId: audit.id })
    }
    const identities = await prisma.$transaction(async tx => ensureOwnedFlagIdentities(tx,
      await tx.flag.findMany({ where: { id: { in: captures.map(flag => flag.id) } }, include: ownedFlagIdentityInclude }),
      { userId: owner, transport: 'fixture' }))
    incidentId = identities.get(captures[0].id)!.improvementId
    expect(identities.get(captures[1].id)!.improvementId).toBe(incidentId)
  })
  afterAll(async () => {
    await deleteAuditScreenshotAssets(captures.map(flag => flag.auditId))
    if (siteId) await prisma.project.deleteMany({ where: { id: siteId } })
    await prisma.audit.deleteMany({ where: { userId: owner } })
    await prisma.user.deleteMany({ where: { id: owner } })
    await prisma.$disconnect()
  })

  it('refuses private finding and repair reads from a retained former-owner Site record', async () => {
    const site = (await loadSiteRecord(siteId))!, flag = (await loadSiteFlagDetail(site, captures[0].id))!
    const replacement = await prisma.user.create({ data: { email: 'replacement-repair-' + randomUUID() + '@example.test' } })
    try {
      await prisma.project.update({ where: { id: siteId }, data: { userId: replacement.id } })
      for (const read of [() => loadSiteFlagDetail(site, captures[0].id), () => loadSiteFindings(site),
        () => loadSiteResolvedFlags(site), () => loadSiteFixBundle(site),
        () => loadSiteRepairEvidence(site, flag, 'https://fixflags.test/private-capture')]) {
        await expect(read()).rejects.toMatchObject({ status: 404 })
      }
    } finally {
      await prisma.project.update({ where: { id: siteId }, data: { userId: owner } })
      await prisma.user.delete({ where: { id: replacement.id } })
    }
  })

  it('withholds an in-flight finding read after transfer while preserving the new owner history', async () => {
    const site = (await loadSiteRecord(siteId))!
    const replacement = await prisma.user.create({ data: { email: 'inflight-repair-' + randomUUID() + '@example.test' } })
    let changed = false
    const raced = prisma.$extends({ query: { flag: {
      async findFirst({ args, query }) {
        const row = await query(args)
        if (!changed) {
          changed = true
          await prisma.project.update({ where: { id: siteId }, data: { userId: replacement.id } })
        }
        return row
      },
    } } })
    const read = vi.spyOn(prisma.flag, 'findFirst').mockImplementation(args => raced.flag.findFirst(args))
    try {
      await expect(loadSiteFlagDetail(site, captures[0].id)).rejects.toMatchObject({ status: 404 })
      expect(changed).toBe(true)
      read.mockRestore()
      const current = (await loadSiteRecord(siteId))!
      expect(current.userId).toBe(replacement.id)
      expect(await loadSiteFlagDetail(current, captures[0].id)).toMatchObject({ sourceAuditId: captures[0].auditId })
      await expect(loadSiteFlagCopyTask(site, incidentId)).rejects.toMatchObject({ status: 404 })
      expect((await loadSiteFlagCopyTask(current, incidentId)).prompt).toContain('Name the existing control')
    } finally {
      read.mockRestore()
      await prisma.project.update({ where: { id: siteId }, data: { userId: owner } })
      await prisma.user.delete({ where: { id: replacement.id } })
    }
  })

  it('withholds private image bytes when ownership changes during the storage read', async () => {
    const site = (await loadSiteRecord(siteId))!, flag = (await loadSiteFlagDetail(site, captures[1].id))!
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
    const screenshotUrl = await uploadScreenshot(flag.sourceAuditId, 'mobile', png, 'owner-fence')
    const review = await prisma.journeyReview.create({ data: { auditId: flag.sourceAuditId, journeyType: 'fixture', startUrl: flag.pageUrl! } })
    await prisma.journeyFinding.create({ data: { journeyReviewId: review.id, flagId: flag.sourceFlagId,
      stepNumber: 1, rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'ACCESSIBILITY',
      problem: flag.problem, evidence: flag.evidence, whyItMatters: flag.whyItMatters, url: flag.pageUrl!, screenshotUrl } })
    const replacement = await prisma.user.create({ data: { email: 'capture-repair-' + randomUUID() + '@example.test' } })
    const original = screenshots.readScreenshot
    const read = vi.spyOn(screenshots, 'readScreenshot').mockImplementation(async (...args) => {
      const image = await original(...args)
      await prisma.project.update({ where: { id: siteId }, data: { userId: replacement.id } })
      return image
    })
    try {
      await expect(loadSiteRepairEvidence(site, flag, 'https://fixflags.test/private-capture')).rejects.toMatchObject({ status: 404 })
      expect(read).toHaveBeenCalledTimes(1)
    } finally {
      read.mockRestore()
      await prisma.project.update({ where: { id: siteId }, data: { userId: owner } })
      await prisma.user.delete({ where: { id: replacement.id } })
    }
  })

  it.each(['SUSPENDED', 'DELETING', 'removed'] as const)('refuses private repair reads after Site authority ends: %s', async state => {
    const site = (await loadSiteRecord(siteId))!
    try {
      if (state === 'removed') await prisma.project.update({ where: { id: siteId }, data: { deletedAt: new Date() } })
      else await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: state } })
      await expect(loadSiteFlagDetail(site, captures[0].id)).rejects.toMatchObject({ status: 404 })
      await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 404 })
      await expect(loadSiteFlagCopyTask(site, incidentId)).rejects.toMatchObject({ status: 404 })
    } finally {
      await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'ACTIVE' } })
      await prisma.project.update({ where: { id: siteId }, data: { deletedAt: null } })
    }
  })
  it('retains exact historical scope and every unresolved incident observation through page continuation', async () => {
    const site = (await loadSiteRecord(siteId))!
    const original = (await loadSiteFlagDetail(site, captures[0].id))!
    const incident = (await loadSiteFlagDetail(site, incidentId))!
    expect(original.affectedPaths).toHaveLength(1)
    expect(incident.affectedPaths).toHaveLength(2)
    const exact = buildSiteRepairBrief(siteId, original, 'https://fixflags.test', captures[0].id)
    let current = buildSiteRepairBrief(siteId, incident, 'https://fixflags.test', incidentId)
    expect(exact.verification.afterDeployment.arguments.flagId).toBe(captures[0].id)
    expect(current.verification.afterDeployment.arguments.flagId).toBe(incidentId)
    expect(exact.observationPage.total).toBe(35)
    expect(current.observationPage.total).toBe(70)
    expect(exact.contextHash).not.toBe(current.contextHash)
    const observations = [...current.flag.supportingObservations!]
    while (current.retrieval.next) {
      const request = current.retrieval.next.arguments
      const reloaded = (await loadSiteFlagDetail(site, request.flagId))!
      current = buildSiteRepairBrief(siteId, reloaded, 'https://fixflags.test', request.flagId, request.observationOffset, request.expectedContextHash)
      observations.push(...current.flag.supportingObservations!)
    }
    expect(observations).toHaveLength(70)
    expect(new Set(observations.map(item => item.evidence)).size).toBe(70)
    expect(new Set(observations.map(item => item.sourceFlagId))).toEqual(new Set(captures.map(flag => flag.id)))
    expect(new Set(observations.map(item => item.sourceAuditId))).toEqual(new Set(captures.map(flag => flag.auditId)))
    expect(JSON.stringify(observations)).not.toContain('private comparison input')
    const task = await loadSiteFlagCopyTask(site, incidentId)
    expect(task.referenceFlagId).toBe(incidentId)
    expect(task.prompt).toContain('25 of 70 supporting observations')
    const bundle = await loadSiteFixBundle(site, undefined, [incidentId])
    expect(bundle.tasks).toEqual([{ referenceFlagId: incidentId, sourceFlagId: task.sourceFlagId, promptHash: task.promptHash }])
    expect(bundle.prompt).toContain(task.bundlePrompt)
  })
  it('retains every selected incident capture when admitting independent repair verification', async () => {
    const site = (await loadSiteRecord(siteId))!
    const incident = (await loadSiteFlagDetail(site, incidentId))!
    const fixed = await recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner,
      idempotencyKey: 'grouped-original-captures', changeSummary: 'Name the recorded controls on both pages' })
    const spec = await buildExecutionSpec({ projectId: siteId, targetUrl: incident.pageUrl!, environment: 'production',
      scope: 'DIAGNOSTIC', outcomes: [], verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: incident.pageUrl!,
        checkId: incident.checkId!, attemptId: fixed.attemptId, parentAuditId: fixed.sourceAuditId } })
    expect(spec.verificationScopes?.map(scope => scope.pageUrl).sort()).toEqual(incident.affectedPaths.toSorted())
    for (const capture of captures) {
      const original = (await loadSiteFlagDetail(site, capture.id))!
      expect(await verificationSourceAuditId(prisma, { parentId: fixed.sourceAuditId, projectId: siteId, executionSpec: spec }, original.pageUrl!))
        .toBe(capture.auditId)
    }
    expect(await verificationSourceAuditId(prisma, { parentId: fixed.sourceAuditId, projectId: 'another-site', executionSpec: spec }, incident.pageUrl!)).toBeNull()
  })
  it('keeps an exact historical Flag repair separate from the grouped attempt', async () => {
    const site = (await loadSiteRecord(siteId))!
    const original = (await loadSiteFlagDetail(site, captures[1].id))!
    const fixed = await recordSiteFlagFix({ siteId, flagId: captures[1].id, userId: owner,
      changeSummary: 'Name only the controls in this original capture' })
    expect((await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).sourceFlagIds).toEqual([])
    const spec = await buildExecutionSpec({ projectId: siteId, targetUrl: original.pageUrl!, environment: 'production',
      scope: 'DIAGNOSTIC', outcomes: [], verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: original.pageUrl!,
        checkId: original.checkId!, attemptId: fixed.attemptId, parentAuditId: fixed.sourceAuditId } })
    expect(spec.verificationScopes?.map(scope => scope.pageUrl)).toEqual(original.affectedPaths)
    expect(spec.verificationSourceFlagIds).toBeUndefined()
  })
  it('refuses to substitute one environment for another selected original capture', async () => {
    const site = (await loadSiteRecord(siteId))!
    const incident = (await loadSiteFlagDetail(site, incidentId))!
    const fixed = await recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner,
      idempotencyKey: 'environment-scope', changeSummary: 'Repair the original controls' })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: captures[0].auditId } })
    try {
      await prisma.audit.update({ where: { id: original.id }, data: { executionSpec: { version: 1, scope: 'SITE',
        targetUrl: original.url, environment: 'staging', checks: {}, outcomes: [], verificationTarget: null } } })
      await expect(buildExecutionSpec({ projectId: siteId, targetUrl: incident.pageUrl!, environment: 'production',
        scope: 'DIAGNOSTIC', outcomes: [], verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: incident.pageUrl!,
          checkId: incident.checkId!, attemptId: fixed.attemptId, parentAuditId: fixed.sourceAuditId } }))
        .rejects.toMatchObject({ code: 'REPAIR_SCOPE_UNAVAILABLE' })
    } finally {
      await prisma.audit.update({ where: { id: original.id }, data: { executionSpec: original.executionSpec ?? Prisma.DbNull } })
    }
  })
  it('refuses malformed historical support and changed evidence without replacing the prepared task', async () => {
    const site = (await loadSiteRecord(siteId))!
    const prepared = await loadSiteFlagCopyTask(site, incidentId)
    const source = await prisma.flag.findUniqueOrThrow({ where: { id: captures[0].id } })
    await prisma.flag.update({ where: { id: source.id }, data: { supportingObservations: { version: 9, items: [] } } })
    await expect(loadSiteFlagCopyTask(site, incidentId)).rejects.toMatchObject({ status: 422 })
    await prisma.flag.update({ where: { id: source.id }, data: { supportingObservations: source.supportingObservations!, evidence: 'Changed recorded observation' } })
    // The original source may be a peer of the displayed representative.
    await prisma.flag.updateMany({ where: { id: { in: captures.map(flag => flag.id) } }, data: { fix: 'Different bounded repair guidance' } })
    await expect(loadSiteFlagCopyTask(site, incidentId, prepared.promptHash)).rejects.toMatchObject({ status: 409 })
  })
  it('reads an exact persisted source image and refuses a pointer into another capture', async () => {
    const site = (await loadSiteRecord(siteId))!
    const flag = (await loadSiteFlagDetail(site, captures[0].id))!
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
    const screenshotUrl = await uploadScreenshot(flag.sourceAuditId, 'desktop', png, 'recorded-source')
    const review = await prisma.journeyReview.create({ data: { auditId: flag.sourceAuditId,
      journeyType: 'fixture', startUrl: flag.pageUrl! } })
    const finding = await prisma.journeyFinding.create({ data: { journeyReviewId: review.id, flagId: captures[0].id,
      stepNumber: 1, url: flag.pageUrl!, rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'ACCESSIBILITY',
      problem: flag.problem, evidence: flag.evidence, whyItMatters: flag.whyItMatters, screenshotUrl } })
    const attached = await loadSiteRepairEvidence(site, flag, 'https://fixflags.test/private-capture')
    expect(attached.image).toEqual(png)
    expect(attached.evidence).toMatchObject({ sourceFlagId: captures[0].id, sourceAuditId: flag.sourceAuditId,
      capture: { state: 'available', bytes: png.length } })
    await prisma.journeyFinding.update({ where: { id: finding.id }, data: {
      screenshotUrl: `/api/screenshots/${captures[1].auditId}/desktop?page=recorded-source` } })
    expect(await loadSiteRepairEvidence(site, flag, 'https://fixflags.test/private-capture'))
      .toMatchObject({ image: null, evidence: { capture: { state: 'unavailable' } } })
    const wrongSite = { ...site, projectId: 'another-site' }
    await expect(loadSiteRepairEvidence(wrongSite, flag, 'https://fixflags.test/private-capture')).rejects.toMatchObject({ status: 404 })
  })
  it('reads performance conditions from the original page collector rather than another task or Site', async () => {
    const site = (await loadSiteRecord(siteId))!
    const original = (await loadSiteFlagDetail(site, captures[0].id))!
    const flag = { ...original, checkId: 'lcp-poor' }
    const measurement = pageSpeedMeasurementFixture(flag.pageUrl!)
    await prisma.auditExecutionTask.create({ data: { auditId: flag.sourceAuditId, targetKey: 'fixture:pagespeed',
      source: 'fixture', pageUrl: flag.pageUrl, status: 'COMPLETED', workKind: 'pagespeed', workState: 'COMPLETED',
      workResult: { kind: 'pagespeed', version: 1, collectedAt: new Date().toISOString(),
        data: { desktop: { diagnostics: { measurement } }, mobile: null } } } })
    expect((await loadSiteRepairEvidence(site, flag, 'https://fixflags.test/private-capture')).evidence.performanceMeasurements).toEqual([measurement])
    await expect(loadSiteRepairEvidence({ ...site, projectId: 'another-site' }, flag, 'https://fixflags.test/private-capture')).rejects.toMatchObject({ status: 404 })
    expect((await loadSiteRepairEvidence(site, { ...flag, pageUrl: 'https://repair-context.test/unrecorded' }, 'https://fixflags.test/private-capture')).evidence.performanceMeasurements).toEqual([])
  })
})
