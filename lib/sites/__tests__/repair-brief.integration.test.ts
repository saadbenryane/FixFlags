import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '../ensure-site'
import { loadSiteFlagDetail, loadSiteFindings, loadSiteResolvedFlags, loadSiteRepairBriefPage } from '../flags'
import { buildSiteRepairBrief } from '../repair-brief'
import { deliverSiteRepairBrief } from '../repair-delivery'
import { MAX_REPAIR_BRIEF_BYTES } from '../repair-budgets'
import { loadSiteFlagCopyTask } from '../application/flag-copy-task'
import { loadSiteFixBundle } from '../application/fix-bundle'
import { ensureOwnedFlagIdentities, ownedFlagIdentityInclude } from '@/lib/improvements/owned-flag-identity'
import { uploadScreenshot, deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { loadSiteRepairEvidence } from '../application/repair-evidence'
import { pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { recordSiteFlagFix } from '../application/flag-verification'
import { buildExecutionSpec } from '../application/execution-spec'
import { verificationSourceAuditId } from '../domain/verification-source'
import { readRepairSources } from '../domain/repair-source'
import { prepareSiteRepairFile } from '../application/repair-file'
import { repairFileSchema, type RepairFileRequest } from '../repair-file-contract'
import * as screenshots from '@/lib/storage/screenshots'
import { executeSiteCommand } from '../application/commands'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('persisted repair context scope', () => {
  const owner = 'repair-context-' + randomUUID()
  let siteId: string, incidentId: string
  const captures: Array<{ id: string; auditId: string }> = []
  async function readFile(scope: RepairFileRequest) {
    const site = (await loadSiteRecord(siteId))!
    const chunks = []
    for await (const chunk of await prepareSiteRepairFile(site, scope, new AbortController().signal)) chunks.push(chunk)
    const json = Buffer.concat(chunks).toString('utf8')
    const file = repairFileSchema.parse(JSON.parse(json))
    expect(file.completion.taskArraySha256).toBe(createHash('sha256').update(JSON.stringify(file.tasks)).digest('hex'))
    return { file, json }
  }
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
        () => loadSiteRepairBriefPage(site, captures[0].id, 'https://fixflags.test'),
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
    const { file, json } = await readFile({ kind: 'bundle', flagIds: [incidentId], manifestHash: bundle.manifest.hash })
    expect(file.tasks).toHaveLength(1)
    expect(file.tasks[0].flag.supportingObservations).toEqual(observations)
    expect(file.tasks[0].contextHash).toBe(task.revision.contextHash)
    expect(json).not.toContain('private comparison input')
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
    await expect(verificationSourceAuditId(prisma, { parentId: fixed.sourceAuditId, projectId: 'another-site', executionSpec: spec }, incident.pageUrl!))
      .rejects.toThrow('The recorded repair source is no longer available')
  })

  it('delivers the same complete multi-Audit incident through indexed pages and full source reads', async () => {
    const site = (await loadSiteRecord(siteId))!
    const full = buildSiteRepairBrief(siteId, (await loadSiteFlagDetail(site, incidentId))!, 'https://fixflags.test', incidentId)
    let page = (await loadSiteRepairBriefPage(site, incidentId, 'https://fixflags.test'))!
    expect(page).toEqual(full)
    const received = [...page.flag.supportingObservations!]
    while (page.retrieval.next) {
      const args = page.retrieval.next.arguments
      page = (await loadSiteRepairBriefPage(site, incidentId, 'https://fixflags.test', args.observationOffset, args.expectedContextHash))!
      expect(page.contextHash).toBe(full.contextHash)
      received.push(...page.flag.supportingObservations!)
    }
    expect(received).toHaveLength(70)
    expect(new Set(received.map(item => item.sourceAuditId))).toEqual(new Set(captures.map(source => source.auditId)))
    expect(JSON.stringify(received)).not.toContain('private comparison input')
    const rows = await prisma.flag.findMany({ where: { id: { in: captures.map(source => source.id) } } })
    expect(rows.every(row => row.supportingObservationIndex !== null)).toBe(true)
  })

  it('fences retained writers, workflow-only changes and mutations beyond the requested window', async () => {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: captures[0].id } })
    const stored = original.supportingObservations as { version: number; items: Array<Record<string, unknown>> }
    const observations = { version: 1, items: Array.from({ length: 65 }, (_, index) => ({ ...stored.items[0], evidence: 'Original control ' + index })) }
    const source = await prisma.flag.create({ data: { auditId: original.auditId, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', position: 50, confidence: 1, pageUrl: original.pageUrl,
      problem: 'Recorded unnamed controls', evidence: 'Original observations', whyItMatters: 'Control purpose', fix: 'Name the original controls',
      verificationRule: 'Original controls have names', supportingObservations: observations } })
    const site = (await loadSiteRecord(siteId))!
    const first = (await loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test'))!
    const indexed = await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })
    expect(indexed.supportingObservationIndex).toMatchObject({ sourceVersion: 0, count: 65, kind: 'recorded' })
    expect(JSON.stringify(indexed.supportingObservationIndex)).not.toMatch(/Original control|items|private comparison input/)
    await prisma.flag.update({ where: { id: source.id }, data: { status: 'IGNORED' } })
    expect((await loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test', 25, first.contextHash))!.contextHash).toBe(first.contextHash)
    expect((await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).supportingObservationIndex).toEqual(indexed.supportingObservationIndex)
    // A retained writer does not know the index. The database still invalidates it.
    await prisma.$executeRaw`UPDATE flags SET "supportingObservations" = jsonb_set("supportingObservations", '{items,64,evidence}', '"Changed final observation"'::jsonb)
      WHERE id = ${source.id}`
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ supportingObservationVersion: 1, supportingObservationIndex: null })
    await expect(loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test', 25, first.contextHash)).rejects.toMatchObject({ code: 'REPAIR_CONTEXT_CHANGED' })
    const fresh = (await loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test'))!
    const last = (await loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test', 50, fresh.contextHash))!
    expect(last.flag.supportingObservations!.at(-1)!.evidence).toBe('Changed final observation')
    const broken = { ...observations, items: observations.items.map((item, index) => index === 64 ? { ...item, checkVersion: 0 } : item) }
    await prisma.flag.update({ where: { id: source.id }, data: { supportingObservations: broken, supportingObservationVersion: 0 } })
    expect((await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).supportingObservationVersion).toBe(2)
    const unavailable = (await loadSiteRepairBriefPage(site, source.id, 'https://fixflags.test'))!
    expect(unavailable.observationPage).toMatchObject({ total: null, complete: false })
    expect(unavailable.flag.supportingObservations).toBeNull()
    expect(unavailable.repair).toMatchObject({ definition: { kind: 'evidence-recovery' } })
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
    expect(spec.verificationSourceFlagIds).toEqual([captures[1].id])
    expect(spec.verificationSources?.flags.map(flag => flag.id)).toEqual([captures[1].id])
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
  it('replaces unsafe saved instructions with an attributable recovery task when evidence is missing', async () => {
    const source = await prisma.flag.create({ data: { auditId: captures[0].auditId, source: 'DETERMINISTIC', checkId: 'unoptimized-images',
      fingerprint: 'missing-evidence-image', rubric: 'EXPERIENCE', severity: 'IMPORTANT', pageUrl: 'https://repair-context.test/missing',
      problem: 'An image is not optimized', evidence: 'The recorded image can save 2MB', whyItMatters: 'The image can delay the page',
      fix: 'Replace the hero image with a smaller asset', confidence: 1, position: 99 } })
    const site = (await loadSiteRecord(siteId))!
    const prepared = await loadSiteFlagCopyTask(site, source.id)
    // Model unavailable saved evidence. This is a controlled database fixture,
    // not an observation that a customer website changed or recovered.
    await prisma.flag.update({ where: { id: source.id }, data: { evidence: '' } })
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })
    const detail = (await loadSiteFlagDetail(site, source.id))!
    expect(detail).toMatchObject({ evidenceMissing: true, repairDefinition: { kind: 'evidence-recovery' } })
    expect(detail.fix).not.toContain(source.fix)
    await expect(loadSiteFlagCopyTask(site, source.id, prepared.promptHash)).rejects.toMatchObject({ status: 409, code: 'REPAIR_TASK_CHANGED' })
    const recovery = await loadSiteFlagCopyTask(site, source.id)
    expect(recovery.prompt).toContain('Do not change the website based on this record')
    expect(recovery.prompt).not.toContain(source.fix)
    expect(recovery.revision.kind).toBe('evidence-recovery')
    const bundle = await loadSiteFixBundle(site, undefined, [source.id])
    expect(bundle.prompt).toContain(recovery.bundlePrompt)
    await executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', flagId: source.id, userId: owner, builder: 'copy',
      client: 'website-clipboard-v2', preparedHandoff: { siteId, referenceFlagId: source.id,
        promptHash: recovery.promptHash, context: recovery.revision } })
    const receipt = await prisma.improvementCycleEvent.findFirstOrThrow({ where: { cycle: { projectId: siteId },
      type: 'HANDOFF_COPIED', idempotencyKey: { contains: recovery.promptHash } } })
    expect(receipt.contextCorrection).toMatchObject({ sourceFlagId: source.id, promptHash: recovery.promptHash,
      context: { kind: 'evidence-recovery', contextHash: recovery.revision.contextHash } })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).toEqual(original)
  })
  it('retains only evidence recovery for malformed historical support and refuses a changed prepared task', async () => {
    const site = (await loadSiteRecord(siteId))!
    const prepared = await loadSiteFlagCopyTask(site, incidentId)
    const source = await prisma.flag.findUniqueOrThrow({ where: { id: captures[0].id } })
    await prisma.flag.update({ where: { id: source.id }, data: { supportingObservations: { version: 9, items: [] } } })
    const unreadable = (await loadSiteFlagDetail(site, incidentId))!
    expect(unreadable.repairDefinition?.kind).toBe('evidence-recovery')
    expect(unreadable.fix).toContain('Do not change the website based on this record')
    const recovery = await loadSiteFlagCopyTask(site, incidentId)
    expect(recovery.revision.kind).toBe('evidence-recovery')
    expect(recovery.prompt).toContain('Do not change the website based on this record')
    await expect(loadSiteFlagCopyTask(site, incidentId, prepared.promptHash)).rejects.toMatchObject({ status: 409 })
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
  it('retains a large recorded observation through authorized retrieval, copied custody and revision-checked repair declaration', async () => {
    const site = (await loadSiteRecord(siteId))!
    const pageUrl = 'https://repair-context.test/large-record'
    const audit = await prisma.audit.create({ data: { userId: owner, projectId: siteId, url: pageUrl,
      status: 'COMPLETED', completedAt: new Date(), includeAi: false } })
    const evidence = 'Observed unnamed 🧭 control with retained diagnostics.\n'.repeat(12_000)
    const source = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
      fingerprint: 'large-repair-record', rubric: 'EXPERIENCE', severity: 'IMPORTANT', confidence: 1, position: 0,
      problem: 'An unnamed control cannot be understood', evidence, whyItMatters: 'Visitors need its purpose',
      fix: 'Name the existing control', pageUrl, affectedPaths: [pageUrl], verificationRule: 'Control has an accessible name',
      supportingObservations: { version: 1, items: [{ source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1,
        pageUrl, evidence, verificationRule: 'Control has an accessible name',
        evidenceTargets: [{ kind: 'element', source: 'measured', device: 'mobile', label: 'Control', selector: '#large',
          context: 'PRIVATE_COMPARISON_CONTEXT' }],
        provenance: { auditId: audit.id, taskId: 'large-native-source', collectedAt: new Date().toISOString() },
      }] } } })
    const copied = await loadSiteFlagCopyTask(site, source.id)
    expect(copied.prompt).toContain('complete repair JSON before any website change')
    expect(copied.revision).toMatchObject({ includedObservationCheckVersions: [1], sourceFlagIds: [source.id] })
    const full = buildSiteRepairBrief(siteId, (await loadSiteFlagDetail(site, source.id))!, 'https://fixflags.test', source.id)
    let delivery = deliverSiteRepairBrief(full)
    let json = ''
    let pages = 0
    for (;;) {
      if (delivery.schemaVersion !== 'fixflags.repair-brief-fragment.v1') throw new Error('Expected large document')
      expect(Buffer.byteLength(JSON.stringify(delivery))).toBeLessThanOrEqual(MAX_REPAIR_BRIEF_BYTES)
      json += delivery.document.text
      pages++
      if (delivery.document.nextOffset === null) {
        expect(createHash('sha256').update(json).digest('hex')).toBe(delivery.document.sha256)
        break
      }
      const args = delivery.retrieval.next!.arguments
      const current = (await loadSiteFlagDetail(site, args.flagId))!
      delivery = deliverSiteRepairBrief(buildSiteRepairBrief(siteId, current, 'https://fixflags.test', args.flagId,
        args.observationOffset, args.expectedContextHash), args)
    }
    expect(pages).toBeGreaterThan(1)
    expect(JSON.parse(json)).toEqual(full)
    expect(json).not.toContain('PRIVATE_COMPARISON_CONTEXT')
    const attemptsBefore = await prisma.improvementAttempt.count({ where: { improvement: { projectId: siteId } } })
    const eventsBefore = await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: siteId } } })
    const downloaded = await readFile({ kind: 'flag', flagId: source.id, expectedPromptHash: copied.promptHash })
    expect(downloaded.file.tasks[0].flag.supportingObservations?.[0].evidence).toBe(evidence)
    expect(downloaded.file.tasks[0].contextHash).toBe(copied.revision.contextHash)
    expect(downloaded.json).not.toContain('PRIVATE_COMPARISON_CONTEXT')
    expect(await prisma.improvementAttempt.count({ where: { improvement: { projectId: siteId } } })).toBe(attemptsBefore)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: siteId } } })).toBe(eventsBefore)
    await executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', flagId: source.id, userId: owner, builder: 'copy',
      client: 'website-clipboard-v2', preparedHandoff: { siteId, referenceFlagId: source.id,
        promptHash: copied.promptHash, context: copied.revision } })
    const input = { siteId, flagId: source.id, userId: owner, idempotencyKey: 'large-repair-' + randomUUID(),
      changeSummary: 'Named the original control', expectedContextHash: copied.revision.contextHash }
    const declared = await recordSiteFlagFix(input)
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })
    expect(attempt).toMatchObject({ sourceAuditId: audit.id, handoffReference: `flag:${source.id}` })
    const frozen = readRepairSources(attempt.sourceObservations)!
    expect(frozen.flags.map(flag => flag.id)).toEqual([source.id])
    expect(frozen.flags[0]).toMatchObject({ auditId: audit.id, supportingObservations: source.supportingObservations })
    expect(attempt.outcome).toBeNull()
    expect(await recordSiteFlagFix(input)).toMatchObject({ attemptId: declared.attemptId })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ evidence, status: 'OPEN' })
    await prisma.flag.update({ where: { id: source.id }, data: { evidence: evidence + 'Changed source evidence' } })
    await expect(recordSiteFlagFix({ ...input, idempotencyKey: 'changed-large-' + randomUUID() }))
      .rejects.toMatchObject({ status: 409, code: 'REPAIR_CONTEXT_CHANGED' })
  })
})
