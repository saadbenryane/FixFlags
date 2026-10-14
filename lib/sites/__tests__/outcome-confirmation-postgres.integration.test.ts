import { randomUUID } from 'node:crypto'
import { Prisma, type Flag, type OutcomeAssessment } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmSiteOutcome, listSiteOutcomes, loadSiteOutcomeDetail, renameSiteOutcome } from '@/lib/sites/outcomes'
import { mcpOutcomePayload } from '@/lib/mcp/outcome-payload'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { persistOutcomeAssessment } from '@/lib/sites/application/outcome-incidents'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { readOutcomeIncident } from '@/lib/sites/domain/outcome-incident'
import { loadSiteFlagDetail, loadSiteFlags, loadSiteResolvedFlags } from '@/lib/sites/flags'
import type { SiteRecord } from '@/lib/sites/types'

const runPostgres = process.env.OUTCOME_CONFIRMATION_DB_REQUIRED === 'true' ? describe : describe.skip

runPostgres('Outcome confirmation PostgreSQL serialization', () => {
  let userId = ''
  let projectId = ''
  let site: SiteRecord

  beforeEach(async () => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    const hostname = new URL(databaseUrl).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error('Outcome confirmation integration tests require a local PostgreSQL database')
    }

    const suffix = randomUUID()
    userId = `outcome-confirmation-user-${suffix}`
    projectId = `outcome-confirmation-project-${suffix}`
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        preferredTools: [],
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        userId,
        name: 'Outcome confirmation fixture',
        url: 'https://example.com/',
        canonicalHost: 'example.com',
      },
    })
    site = {
      siteId: projectId,
      kind: 'project',
      projectId,
      provisionalSiteId: null,
      url: 'https://example.com/',
      canonicalHost: 'example.com',
      name: 'Outcome confirmation fixture',
      primaryAuditId: null,
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId,
    }
  })

  afterEach(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  async function genericOutcome(slug: string) {
    return prisma.siteOutcome.create({
      data: {
        projectId,
        name: 'A customer can complete an important action',
        slug,
        inferenceSource: 'browser',
      },
    })
  }

  it('keeps later Flags open while showing a successful repair only for its original captured occurrence', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const base = Date.now()
    const original = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 3000) } })
    const later = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 2000) } })
    const proof = await prisma.audit.create({ data: { projectId, userId, parentId: original.id, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 1000) } })
    const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: 'check:broken-internal-links', status: 'VERIFIED',
      title: 'Repair a page link', judgment: 'Recorded response failure', expectedBenefit: 'The destination responds',
      recommendedChange: 'Restore the destination', successCondition: 'Comparable destination response succeeds' } })
    const flags: Flag[] = []
    for (const [index, audit] of [original, later].entries()) {
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'broken-internal-links',
        fingerprint: improvement.fingerprint, rubric: 'REACH', severity: 'IMPORTANT', impactTag: 'SEO', confidence: 1,
        problem: 'A page destination was unavailable', evidence: 'Controlled HTTP 503', whyItMatters: 'The page cannot be reached',
        fix: 'Restore the destination', pageUrl: site.url + (index ? 'later' : 'original'), status: 'OPEN', position: 0,
        createdAt: new Date(base - 3000 + index * 1000) } })
      await prisma.improvementOccurrence.create({ data: { improvementId: improvement.id, auditId: audit.id, flagId: flag.id,
        kind: 'OBSERVED', createdAt: flag.createdAt } })
      flags.push(flag)
    }
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: original.id,
      handoffReference: 'flag:' + flags[0].id, verificationAuditId: proof.id, builder: 'site', outcome: 'IMPROVED', comparable: true } })
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flags[1].id, status: 'OPEN', verificationState: 'still_open' }])
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flags[0].id, affectedPaths: [flags[0].pageUrl] }])
    expect(await loadSiteFlagDetail(site, improvement.id)).toMatchObject({ sourceFlagId: flags[1].id, status: 'OPEN', verificationState: 'still_open' })
    expect(await loadSiteFlagDetail(site, flags[0].id)).toMatchObject({ sourceFlagId: flags[0].id, status: 'VERIFIED', verificationState: 'verified' })
    const summary = (await loadSiteSummaries(userId)).find(value => value.id === projectId)!
    expect(summary.presentation.flags.count).toBe(1)
    expect(summary.presentation.result.state).toBe('flags')
  })

  it('retains newer incidents through a delayed older success, then verifies genuine recovery and recurrence', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'incident-order', kind: 'AVAILABILITY' } })
    const fingerprint = outcomeFlagFingerprint(outcome.id, 'http')
    const improvement = await prisma.improvement.create({ data: { projectId, outcomeId: outcome.id, fingerprint,
      title: 'Restore the page', judgment: 'Controlled unavailable response', expectedBenefit: 'The page responds',
      recommendedChange: 'Restore the response', successCondition: 'Comparable public response succeeds', status: 'PROPOSED' } })
    const base = Date.now(), coverage = { environment: 'production', policy: 'ALL_REQUIRED', requiredBindings: ['http'], observedBindings: ['http'], scope: null,
      bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url }, scope: null }] }
    async function observation(label: string, requested: number, observed: number, state: 'FLAG' | 'CLEAR') {
      const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base + observed), isPublic: false } })
      const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: label,
        status: 'COMPLETED', requestedAt: new Date(base + requested), selections: { create: { outcomeId: outcome.id } } } })
      const flag = state === 'FLAG' ? await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', fingerprint,
        rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'The page was unavailable', evidence: 'Controlled HTTP 503',
        whyItMatters: 'The page cannot be reached', fix: 'Restore the page', confidence: 1, position: 0 } }) : null
      if (flag) await prisma.improvementOccurrence.create({ data: { improvementId: improvement.id, flagId: flag.id, auditId: audit.id, kind: 'OBSERVED' } })
      const input = { projectId, bindingKeys: ['http'], failureFlagIds: flag ? [flag.id] : [], outcomeKind: 'AVAILABILITY',
        outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id, improvementId: improvement.id, state,
        summary: 'Controlled ' + state.toLowerCase() + ' observation', coverage, evidence: { reason: state === 'FLAG' ? 'http_unavailable' : 'available' },
        assessedAt: new Date(base + observed), validUntil: new Date(base + observed + 60_000) }
      return { audit, run, flag, input }
    }
    const original = await observation('first-failure', -50_000, -40_000, 'FLAG')
    const delayed = await observation('delayed-success', -30_000, -5_000, 'CLEAR')
    const newer = await observation('newer-failure', -20_000, -10_000, 'FLAG')
    await persistOutcomeAssessment(original.input)
    const current = await persistOutcomeAssessment(newer.input)
    expect(readOutcomeIncident(current.evidence)?.transition).toBe('ongoing_failure')
    const historical = await persistOutcomeAssessment(delayed.input)
    expect(historical.evidence).toMatchObject({ supersededByAssessmentId: current.id, incident: { transition: 'clear', recoveredFlagIds: [] } })
    expect(await persistOutcomeAssessment(delayed.input)).toEqual(historical)
    await expect(persistOutcomeAssessment({ ...delayed.input, projectId: 'another-site' })).rejects.toThrow('no matching Site request')
    for (const flag of [original.flag!, newer.flag!]) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
      .toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).toMatchObject({ status: 'PROPOSED' })
    const continued = await observation('continued-failure', 1000, 2000, 'FLAG')
    const ongoing = await persistOutcomeAssessment(continued.input)
    expect(readOutcomeIncident(ongoing.evidence)).toMatchObject({ transition: 'ongoing_failure', incidentRunRequestId: original.run.id })
    const repaired = await observation('genuine-recovery', 3000, 4000, 'CLEAR')
    expect(readOutcomeIncident((await persistOutcomeAssessment(repaired.input)).evidence)?.transition).toBe('recovery')
    for (const flag of [original.flag!, newer.flag!, continued.flag!]) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
      .toMatchObject({ status: 'FIXED', resolvedInId: repaired.audit.id })
    const repeated = await observation('genuine-recurrence', 5000, 6000, 'FLAG')
    expect(readOutcomeIncident((await persistOutcomeAssessment(repeated.input)).evidence)?.transition).toBe('regression')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: repeated.flag!.id } })).toMatchObject({ status: 'REGRESSED' })
  })

  it('keeps the latest requested answer and its method when an older run finishes later', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'request-order', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url } } } } })
    const base = Date.now(), coverage = { environment: 'production', requiredBindings: ['http'],
      bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
    const rows: Array<{ audit: { id: string }; run: { id: string }; assessment: OutcomeAssessment }> = []
    for (const older of [false, true]) {
      const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', executionSpec: {
        version: 1, scope: 'OUTCOMES', targetUrl: site.url, environment: 'production', checks: {}, verificationTarget: null,
        outcomes: [{ id: outcome.id, kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
          bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, required: true, config: { startUrl: site.url } }] }],
      } } })
      const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: older ? 'old-request' : 'latest-request',
        status: 'COMPLETED', requestedAt: new Date(base - (older ? 120_000 : 60_000)), selections: { create: { outcomeId: outcome.id } } } })
      const assessedAt = new Date(base - (older ? 0 : 30_000))
      const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id,
        state: older ? 'CLEAR' : 'COULD_NOT_VERIFY', summary: older ? 'Earlier request succeeded' : 'The latest request could not complete',
        assessedAt, validUntil: new Date(base + 60_000), coverage } })
      await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id, bindingKey: 'http', mechanism: 'HTTP_AVAILABILITY',
        bindingVersion: 1, disposition: older ? 'SUCCEEDED' : 'BLOCKED', reason: older ? 'http_ok' : 'request_failed', createdAt: assessedAt } })
      rows.push({ audit, run, assessment })
    }
    const [listed, detail] = await Promise.all([listSiteOutcomes(site), loadSiteOutcomeDetail(site, outcome.id)])
    expect(listed.find(value => value.id === outcome.id)).toMatchObject({ state: 'COULD_NOT_VERIFY', latestRunId: rows[0].run.id })
    expect(detail).toMatchObject({ state: 'COULD_NOT_VERIFY', summary: rows[0].assessment.summary, latestRunId: rows[0].run.id })
    expect(detail!.bindings[0].latestEvidence).toMatchObject({ auditId: rows[0].audit.id, disposition: 'BLOCKED', reason: 'request_failed' })
    expect(mcpOutcomePayload(detail!).methods[0].evidence).toMatchObject({ auditId: rows[0].audit.id, disposition: 'BLOCKED' })
    expect(detail!.timeline.some(event => event.type === 'attempt' && event.auditId === rows[1].audit.id)).toBe(true)
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: rows[1].assessment.id } })).toEqual(rows[1].assessment)
  })

  it('projects current watched configuration consistently across the list and Outcome detail without rewriting history', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    // Controlled report facts isolate read projection from collector acceptance.
    const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(),
      reportCompleteness: 'FULL', evidenceCoverage: { metadata: true }, executionSpec: {
        version: 1, scope: 'SITE', targetUrl: site.url, environment: 'production',
        checks: { 'no-https': 1, 'security-mixed-content': 1 }, outcomes: [], verificationTarget: null,
      } } })
    await prisma.auditPage.create({ data: { auditId: audit.id, url: site.url, normalizedUrl: site.url, role: 'primary', position: 0, status: 'COMPLETED' } })
    await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'module:security', source: 'DETERMINISTIC', status: 'COMPLETED',
      detail: { kind: 'site-module-check', version: 1, module: 'security', pageUrl: site.url, passed: true, applicable: true,
        assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Secure transport', observed: 'Secure transport', passed: true })) } } })
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'current-read', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url } } } } })
    const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: 'read-proof', status: 'COMPLETED' } })
    const coverage = { environment: 'production', requiredBindings: ['http'], bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
    const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id,
      state: 'CLEAR', summary: 'Controlled availability observation', validUntil: new Date(Date.now() + 60_000), coverage } })
    async function expectCurrent(state: 'CLEAR' | 'COULD_NOT_VERIFY') {
      const [summaries, details] = await Promise.all([loadSiteSummaries(userId), listSiteOutcomes(site)])
      expect(summaries.find(row => row.id === projectId)?.presentation.result.state).toBe(state === 'CLEAR' ? 'clear' : 'could_not_verify')
      expect(details.find(row => row.id === outcome.id)?.state).toBe(state)
    }
    await expectCurrent('CLEAR')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { version: 2 } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { version: 1, enabled: false } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { enabled: true } })
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { environment: 'staging' } })
    await expectCurrent('COULD_NOT_VERIFY')
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { environment: 'production' } })
    const fixture = await prisma.outcomeFixture.create({ data: { projectId, name: 'Read-only fixture metadata', targetUrl: site.url,
      fieldMapping: {}, encryptedValues: 'unused-in-read-fixture', successCriterion: {}, resetUrl: site.url, cleanupUrl: site.url,
      version: 1, lastDryRunVersion: 1, authorizedAt: new Date() } })
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } },
      data: { mechanism: 'SAFE_FORM', version: 2, config: { fixtureId: fixture.id } } })
    await expectCurrent('COULD_NOT_VERIFY')
    const formRun = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: 'form-read-proof', status: 'COMPLETED' } })
    const formAssessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: formRun.id, auditId: audit.id,
      state: 'CLEAR', summary: 'Controlled form observation', validUntil: new Date(Date.now() + 60_000), coverage: {
        environment: 'production', requiredBindings: ['http'], bindings: [{ key: 'http', mechanism: 'SAFE_FORM', version: 2,
          fixture: { id: fixture.id, version: 1 } }],
      } } })
    await expectCurrent('CLEAR')
    await prisma.outcomeFixture.update({ where: { id: fixture.id }, data: { authorizedAt: null } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeFixture.update({ where: { id: fixture.id }, data: { authorizedAt: new Date(), version: 2, lastDryRunVersion: 2 } })
    await expectCurrent('COULD_NOT_VERIFY')
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: formAssessment.id } })).toEqual(formAssessment)
  })

  it('never leaves an enabled binding behind when a concurrent withdrawal wins', async () => {
    for (let index = 0; index < 8; index += 1) {
      const outcome = await genericOutcome(`race-${index}`)
      await Promise.all([
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' }),
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: false }),
      ])

      const stored = await prisma.siteOutcome.findUniqueOrThrow({
        where: { id: outcome.id },
        include: { bindings: { where: { enabled: true } } },
      })
      if (stored.confirmedAt === null) {
        expect(stored.bindings, 'an unconfirmed Outcome must not execute unattended').toHaveLength(0)
      } else {
        expect(stored.bindings.map((binding) => binding.key)).toEqual(['checkout-browser-v1'])
      }
    }
  })

  it('keeps a customer rename and the original time across a repeated same-kind request', async () => {
    const outcome = await genericOutcome('same-kind')
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })
    await renameSiteOutcome({
      site,
      outcomeId: outcome.id,
      name: 'A customer can buy the annual plan',
    })
    const before = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })

    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })

    const after = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })
    expect(after.name).toBe('A customer can buy the annual plan')
    expect(after.confirmedAt?.toISOString()).toBe(before.confirmedAt?.toISOString())
  })

  it('does not wait on or touch a foreign tenant Outcome row', async () => {
    const foreignProject = await prisma.project.create({
      data: {
        userId,
        name: 'Foreign Outcome fixture',
        url: 'https://other.example/',
        canonicalHost: 'other.example',
      },
    })
    const foreignOutcome = await prisma.siteOutcome.create({
      data: {
        projectId: foreignProject.id,
        name: 'Foreign purchase',
        slug: 'foreign-purchase',
        kind: 'CHECKOUT',
        inferenceSource: 'user',
        confirmedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    })

    let releaseLock: (() => void) | undefined
    const release = new Promise<void>((resolve) => { releaseLock = resolve })
    let announceLock: (() => void) | undefined
    const locked = new Promise<void>((resolve) => { announceLock = resolve })
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "site_outcomes"
        WHERE "id" = ${foreignOutcome.id}
        FOR UPDATE
      `)
      announceLock?.()
      await release
    })
    await locked

    const attempted = confirmSiteOutcome({
      site,
      outcomeId: foreignOutcome.id,
      confirmed: false,
    })
    const timeout = Symbol('foreign lock timeout')
    let observed: Awaited<typeof attempted> | typeof timeout
    try {
      observed = await Promise.race([
        attempted,
        new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 1_000)),
      ])
      expect(observed, 'a foreign row lock must not contend with this tenant').not.toBe(timeout)
      expect(observed).toBeNull()
    } finally {
      releaseLock?.()
      await holder
      await attempted
    }

    const unchanged = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: foreignOutcome.id } })
    expect(unchanged.confirmedAt?.toISOString()).toBe('2026-09-29T00:00:00.000Z')
    expect(unchanged.name).toBe('Foreign purchase')
  })
})
