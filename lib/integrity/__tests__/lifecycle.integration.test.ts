import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import { uninstallShop } from '@/lib/shopify/uninstall'
import { getValidOfflineToken, persistTokenSet } from '@/lib/shopify/tokens'
import { uploadIntegrityArtifact, readIntegrityArtifact } from '../storage'
import { runIntegrityPathJob } from '../run-path-job'
import type { PathProbeResult } from '../types'
import { processDueIntegrityPulses } from '../pulse'
import { processDueIntegrityWatches } from '../watch'
import { runIntegrityImprove } from '../improve'
import * as openCheck from '@/lib/audit/open-check'
import * as metadataReader from '@/lib/audit/metadata'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'

const boundaries = vi.hoisted(() => ({ probe: vi.fn(), alert: vi.fn().mockResolvedValue(undefined), improve: vi.fn().mockResolvedValue(undefined), track: vi.fn(), enqueue: vi.fn(), email: vi.fn() }))
vi.mock('../run-path-probe', () => ({ runPathProbe: boundaries.probe }))
vi.mock('../alerts', () => ({ sendIntegrityAlert: boundaries.alert }))
vi.mock('../enqueue', () => ({ enqueueIntegrityImprove: boundaries.improve, enqueueIntegrityProbe: boundaries.enqueue }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: boundaries.track }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: boundaries.email } } }))
const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('Shopify path publication in disposable PostgreSQL', () => {
  const domains: string[] = [], namespaces: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(() => {
    vi.resetAllMocks()
    boundaries.alert.mockResolvedValue(undefined); boundaries.improve.mockResolvedValue(undefined); boundaries.enqueue.mockResolvedValue(undefined)
    boundaries.email.mockResolvedValue({ data: { id: 'accepted-local-receipt' }, error: null })
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    if (domains.length) await prisma.shopifyShop.deleteMany({ where: { shopDomain: { in: domains } } })
    for (const namespace of namespaces) await fs.rm(path.join(process.cwd(), '.data', 'integrity', namespace), { recursive: true, force: true })
  })
  afterAll(async () => {
    try {
      if (domains.length) await prisma.shopifyShop.deleteMany({ where: { shopDomain: { in: domains } } })
      for (const namespace of namespaces) await fs.rm(path.join(process.cwd(), '.data', 'integrity', namespace), { recursive: true, force: true })
    } finally { await prisma.$disconnect() }
  })
  async function shopPath() {
    const shopDomain = 'path-' + randomUUID() + '.myshopify.com'
    domains.push(shopDomain)
    const shop = await prisma.shopifyShop.create({ data: { shopDomain, encryptedAccessToken: encryptSecret('admitted-token'),
      paths: { create: { storefrontUrl: 'https://example.com/product', label: 'Canvas Tote', watchNextRunAt: new Date(), pulseNextRunAt: new Date() } } }, include: { paths: true } })
    return { shop, source: shop.paths[0] }
  }
  function heldProbe() {
    const gates: Array<{ release: () => void; namespace: string; url: string; healthy: boolean }> = []
    boundaries.probe.mockImplementation(async ({ runId, url }: { runId: string; url: string }) => {
      let release!: () => void
      const held = new Promise<void>(resolve => { release = resolve })
      const gate = { release, namespace: runId, url, healthy: false }
      gates.push(gate); namespaces.push(runId)
      await held
      const artifact = await uploadIntegrityArtifact(runId, 'attempt-1-failure.png', Buffer.from('late frame'), 'image/png')
      return result(url, artifact.url, gate.healthy)
    })
    return gates
  }
  function result(url: string, screenshotUrl: string, healthy = false): PathProbeResult {
    const outcome = { reachedCheckout: healthy, httpStatus: 200, buyControlFound: true, buyControlClicked: true,
      cartUpdated: healthy, checkoutErrorVisible: false, botWall: false, passwordGate: false, timedOut: false,
      pageUnavailable: false, failedStep: healthy ? null : 'add_to_cart' as const }
    const attempt = { outcome, steps: [{ label: 'add_to_cart' as const, url, screenshotUrl }, { label: healthy ? 'checkout' as const : 'failure' as const, url, screenshotUrl }], videoUrl: null, gifUrl: null, finalUrl: url }
    return { health: healthy ? 'GREEN' : 'RED', reason: healthy ? 'checkout_reached' : 'add_to_cart_noop', confirmed: true, attempts: healthy ? [attempt] : [attempt, attempt],
      steps: attempt.steps, videoUrl: null, gifUrl: null, failedStep: 'add_to_cart', finalUrl: url }
  }

  it.each(['uninstall', 'reinstall'] as const)('discards a walk completing after %s and removes only its late media', async transition => {
    const { shop, source } = await shopPath(), gates = heldProbe()
    const pending = runIntegrityPathJob(source.id, 'fixture')
    void pending.catch(() => undefined)
    try {
      await vi.waitFor(() => expect(gates).toHaveLength(1))
      await uninstallShop(shop.shopDomain)
      if (transition === 'reinstall') await persistTokenSet(shop.shopDomain, { accessToken: 'replacement-install', refreshToken: null,
        scope: 'read_products', expiresAt: null, refreshExpiresAt: null })
      gates[0].release()
      await pending
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(0)
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ health: 'UNKNOWN', lastVerifiedAt: null,
        watchNextRunAt: null, pulseNextRunAt: null })
      expect(await readIntegrityArtifact(gates[0].namespace, 'attempt-1-failure.png')).toBeNull()
      expect(boundaries.alert).not.toHaveBeenCalled()
      expect(boundaries.improve).not.toHaveBeenCalled()
    } finally { gates.forEach(gate => gate.release()); await pending.catch(() => undefined) }
  })
  it('retains only the newest committed walk and never deletes that walk while discarding an older completion', async () => {
    const { source } = await shopPath(), gates = heldProbe()
    const first = runIntegrityPathJob(source.id, 'fixture-old')
    void first.catch(() => undefined)
    let second: Promise<void> | undefined
    try {
      await vi.waitFor(() => expect(gates).toHaveLength(1))
      second = runIntegrityPathJob(source.id, 'fixture-new')
      await vi.waitFor(() => expect(gates).toHaveLength(2))
      gates[1].healthy = true; gates[1].release()
      await second
      gates[0].release(); await first
      expect(gates[0].namespace).not.toBe(gates[1].namespace)
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(1)
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ health: 'GREEN', reason: 'checkout_reached' })
      expect(await readIntegrityArtifact(gates[0].namespace, 'attempt-1-failure.png')).toBeNull()
      expect(await readIntegrityArtifact(gates[1].namespace, 'attempt-1-failure.png')).toEqual(Buffer.from('late frame'))
      expect(boundaries.alert).not.toHaveBeenCalled()
      expect(boundaries.improve).toHaveBeenCalledOnce()
    } finally { gates.forEach(gate => gate.release()); await Promise.allSettled([first, ...(second ? [second] : [])]) }
  })
  it('publishes an active confirmed failure with the exact source record before notification admission', async () => {
    const { source } = await shopPath(), gates = heldProbe()
    const pending = runIntegrityPathJob(source.id, 'fixture-current')
    try {
      await vi.waitFor(() => expect(gates).toHaveLength(1))
      gates[0].release(); await pending
      const saved = await prisma.verificationRun.findFirstOrThrow({ where: { pathId: source.id } })
      expect(saved).toMatchObject({ health: 'RED', reason: 'add_to_cart_noop', confirmed: true })
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ lastVerifiedAt: saved.createdAt, health: 'RED' })
      expect(boundaries.alert).toHaveBeenCalledWith(expect.objectContaining({ runId: saved.id, authority: expect.objectContaining({ id: source.id }) }))
    } finally { gates.forEach(gate => gate.release()); await pending.catch(() => undefined) }
  })

  it('cannot claim a Watch selected before uninstall', async () => {
    const { shop, source } = await shopPath()
    const original = prisma.revenuePath.findMany.bind(prisma.revenuePath)
    const reader = vi.spyOn(prisma.revenuePath, 'findMany').mockImplementationOnce(async args => {
      const selected = await original(args)
      await uninstallShop(shop.shopDomain)
      return selected
    })
    try {
      expect(await processDueIntegrityWatches()).toEqual({ processed: 0 })
      expect(boundaries.enqueue).not.toHaveBeenCalled()
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ watchNextRunAt: null, watchLeaseUntil: null })
    } finally { reader.mockRestore() }
  })
  it('cannot reschedule a pulse or enqueue a walk after uninstall during its HTTP observation', async () => {
    const { shop, source } = await shopPath()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const observation = vi.spyOn(openCheck, 'openCheckDestination').mockImplementation(async url => {
      await held
      return { url, canonicalUrl: url, finalUrl: url, status: 503, outcome: 'server_error', evidence: 'Controlled unavailable page', shouldFlagDead: true }
    })
    const pending = processDueIntegrityPulses()
    try {
      await vi.waitFor(() => expect(observation).toHaveBeenCalledOnce())
      await uninstallShop(shop.shopDomain)
      release()
      expect(await pending).toEqual({ processed: 1, walks: 0 })
      expect(boundaries.enqueue).not.toHaveBeenCalled()
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ pulseNextRunAt: null, pulseLeaseUntil: null })
    } finally { release(); await pending; observation.mockRestore() }
  })
  it('retains advice when a revoked collector finishes instead of replacing current records', async () => {
    const { shop, source } = await shopPath()
    await prisma.revenuePath.update({ where: { id: source.id }, data: { health: 'GREEN', lastVerifiedAt: new Date() } })
    await prisma.improveItem.create({ data: { pathId: source.id, group: 'Search', title: 'Retained advice', why: 'Original evidence' } })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const reader = vi.spyOn(metadataReader, 'fetchAndParseMetadataWithHeaders').mockImplementation(async url => {
      await held
      return { metadata: metadataReader.parseMetadataFromHtml('<html><head></head><body><h1>Shop</h1></body></html>', url), responseHeaders: {} }
    })
    const pending = runIntegrityImprove(source.id)
    try {
      await vi.waitFor(() => expect(reader).toHaveBeenCalledOnce())
      await uninstallShop(shop.shopDomain)
      release()
      expect(await pending).toBe(0)
      expect(await prisma.improveItem.findMany({ where: { pathId: source.id }, select: { title: true } })).toEqual([{ title: 'Retained advice' }])
    } finally { release(); await pending; reader.mockRestore() }
  })
  it('rechecks the committed source and active grant between email and Slack using real records', async () => {
    const { shop, source } = await shopPath(), gates = heldProbe()
    await prisma.shopifyShop.update({ where: { id: shop.id }, data: { email: 'synthetic@example.test', slackWebhookEncrypted: encryptSecret('https://hooks.slack.com/services/fixture') } })
    const running = runIntegrityPathJob(source.id, 'fixture-notification')
    await vi.waitFor(() => expect(gates).toHaveLength(1)); gates[0].release(); await running
    const record = await prisma.verificationRun.findFirstOrThrow({ where: { pathId: source.id } })
    const actual = await vi.importActual<typeof import('../alerts')>('../alerts')
    let release!: () => void
    boundaries.email.mockImplementation(() => new Promise(resolve => { release = () => resolve({ data: { id: 'accepted-local-receipt' }, error: null }) }))
    const slack = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', slack)
    const pending = actual.sendIntegrityAlert({ authority: { ...source, shop }, runId: record.id })
    try {
      await vi.waitFor(() => expect(boundaries.email).toHaveBeenCalledOnce())
      await uninstallShop(shop.shopDomain)
      release(); await pending
      expect(slack).not.toHaveBeenCalled()
      const saved = await prisma.verificationRun.findUniqueOrThrow({ where: { id: record.id } })
      expect(saved).toMatchObject({ health: 'RED', confirmed: true })
    } finally { release?.(); await pending }
  })

  it('retains admitted public observation authority through ordinary token renewal', async () => {
    const { shop, source } = await shopPath(), gates = heldProbe()
    await prisma.shopifyShop.update({ where: { id: shop.id }, data: { tokenExpiresAt: new Date(0), encryptedRefreshToken: encryptSecret('renewal-refresh') } })
    const pending = runIntegrityPathJob(source.id, 'fixture-renewal')
    try {
      await vi.waitFor(() => expect(gates).toHaveLength(1))
      const provider = vi.fn(async (url: string) => {
        expect(url).toBe('https://' + shop.shopDomain + '/admin/oauth/access_token')
        return Response.json({ access_token: 'renewed-access', refresh_token: 'renewed-refresh', expires_in: 3600 })
      })
      vi.stubGlobal('fetch', provider)
      expect(await getValidOfflineToken(shop.shopDomain)).toBe('renewed-access')
      expect((await prisma.shopifyShop.findUniqueOrThrow({ where: { id: shop.id } })).authorizationVersion).toBe(shop.authorizationVersion)
      gates[0].release(); await pending
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(1)
      expect(boundaries.alert).toHaveBeenCalledOnce()
    } finally { gates.forEach(gate => gate.release()); await pending.catch(() => undefined) }
  })

  it('keeps active Watch and pulse work functional without inventing a completed purchase', async () => {
    const { source } = await shopPath()
    const observation = vi.spyOn(openCheck, 'openCheckDestination').mockResolvedValue({ url: source.storefrontUrl,
      canonicalUrl: source.storefrontUrl, finalUrl: source.storefrontUrl, status: 503, outcome: 'server_error', evidence: 'Controlled failure', shouldFlagDead: true })
    try {
      expect(await processDueIntegrityPulses()).toEqual({ processed: 1, walks: 1 })
      expect(await processDueIntegrityWatches()).toEqual({ processed: 1 })
      expect(boundaries.enqueue).toHaveBeenCalledWith(source.id, 'pulse')
      expect(boundaries.enqueue).toHaveBeenCalledWith(source.id, 'schedule')
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ health: 'UNKNOWN', lastVerifiedAt: null, lastVerificationRunId: null })
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(0)
    } finally { observation.mockRestore() }
  })
  it('publishes advice from an unchanged active source', async () => {
    const { source } = await shopPath(), gates = heldProbe()
    const running = runIntegrityPathJob(source.id, 'fixture-advice')
    await vi.waitFor(() => expect(gates).toHaveLength(1)); gates[0].healthy = true; gates[0].release(); await running
    const reader = vi.spyOn(metadataReader, 'fetchAndParseMetadataWithHeaders').mockResolvedValue({
      metadata: metadataReader.parseMetadataFromHtml('<html><head></head><body><h1>Shop</h1></body></html>', source.storefrontUrl), responseHeaders: {} })
    try {
      const count = await runIntegrityImprove(source.id)
      expect(count).toBeGreaterThan(0)
      expect(await prisma.improveItem.count({ where: { pathId: source.id } })).toBe(count)
    } finally { reader.mockRestore() }
  })
  it('commits a linked Site finding with its source and leaves independent verification responsible for resolution', async () => {
    const { shop, source } = await shopPath(), gates = heldProbe()
    const user = await prisma.user.create({ data: { email: 'linked-' + randomUUID() + '@example.test' } })
    let running: Promise<void> | undefined
    try {
      const project = await prisma.project.create({ data: { userId: user.id, name: 'Linked fixture', url: source.storefrontUrl, canonicalHost: 'example.com' } })
      await prisma.shopifyShop.update({ where: { id: shop.id }, data: { projectId: project.id } })
      running = runIntegrityPathJob(source.id, 'fixture-linked-failure')
      await vi.waitFor(() => expect(gates).toHaveLength(1)); gates[0].release(); await running
      const finding = await prisma.improvement.findUniqueOrThrow({ where: { projectId_fingerprint: { projectId: project.id, fingerprint: 'integrity:' + source.id } } })
      expect(finding).toMatchObject({ status: 'PROPOSED', judgment: 'add_to_cart_noop' })
      const failed = await prisma.verificationRun.findFirstOrThrow({ where: { pathId: source.id } })
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ lastVerificationRunId: failed.id, health: 'RED' })
      running = runIntegrityPathJob(source.id, 'fixture-linked-healthy')
      await vi.waitFor(() => expect(gates).toHaveLength(2)); gates[1].healthy = true; gates[1].release(); await running
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: finding.id } })).toMatchObject({ status: 'PROPOSED' })
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(2)
    } finally {
      gates.forEach(gate => gate.release()); await running?.catch(() => undefined)
      await prisma.shopifyShop.updateMany({ where: { id: shop.id }, data: { projectId: null } })
      await prisma.user.deleteMany({ where: { id: user.id } })
    }
  })
  it('acknowledges a revoked in-flight queue job without publishing or retaining its late media', async () => {
    const { shop, source } = await shopPath(), gates = heldProbe()
    const worker = startWorker(), queue = getAuditQueue()
    try {
      await worker.waitUntilReady()
      const job = await queue.add('integrity-probe', { pathId: source.id, trigger: 'fixture-queue' }, { jobId: 'integrity-fixture-' + randomUUID(), attempts: 1 })
      await vi.waitFor(() => expect(gates).toHaveLength(1), { timeout: 10_000 })
      await uninstallShop(shop.shopDomain)
      gates[0].release()
      await vi.waitFor(async () => expect(await job.getState()).toBe('completed'), { timeout: 10_000 })
      expect(await prisma.verificationRun.count({ where: { pathId: source.id } })).toBe(0)
      expect(await readIntegrityArtifact(gates[0].namespace, 'attempt-1-failure.png')).toBeNull()
      expect(boundaries.alert).not.toHaveBeenCalled()
      expect(await prisma.revenuePath.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ health: 'UNKNOWN', watchNextRunAt: null, pulseNextRunAt: null })
    } finally {
      gates.forEach(gate => gate.release())
      boundaries.probe.mockResolvedValue(result(source.storefrontUrl, ''))
      await worker.close()
      const queues = [queue, ...(['http', 'browser', 'provider', 'evaluate', 'availability'] as const).map(getAuditTaskQueue)]
      const clients = await Promise.all(queues.map(queue => queue.client))
      await Promise.all(queues.map(queue => queue.close()))
      new Set(clients).forEach(client => client.disconnect())
    }
  }, 30_000)

})
