import type { Prisma } from '@prisma/client'
import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { runPathProbe } from './run-path-probe'
import { sendIntegrityAlert } from './alerts'
import { enqueueIntegrityImprove } from './enqueue'
import { upsertIntegritySiteFlag } from './site-flag'
import { integrityPathWrite } from './path-authority'
import { deleteIntegrityRunArtifacts } from './storage'
import { checkoutProbeVerdict } from './purchase'
import { newPathArtifactNamespace } from './artifact-namespace'

const WATCH_MS = 6 * 60 * 60 * 1000
const PULSE_MS = 15 * 60 * 1000

export async function runIntegrityPathJob(pathId: string, trigger: string): Promise<void> {
  const path = await prisma.revenuePath.findUnique({
    where: { id: pathId },
    include: { shop: true },
  })
  if (!path || path.shop.uninstalledAt || !path.shop.encryptedAccessToken) return

  const namespace = newPathArtifactNamespace(pathId)
  const result = await runPathProbe({
    runId: namespace,
    url: path.storefrontUrl,
    allowLocalhost:
      process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_SHOPIFY_FIXTURE === '1',
  })

  const verdict = checkoutProbeVerdict(result)
  const next = verdict.isClear ? 'GREEN' : verdict.isFlag ? 'RED' : 'UNKNOWN'
  const hasEvidence = Boolean(result.videoUrl || result.gifUrl || result.steps.some(step => step.screenshotUrl))
  const published = await integrityPathWrite(path, async (tx, current, shop) => {
    if (current.lastVerificationRunId !== path.lastVerificationRunId || current.lastVerifiedAt?.getTime() !== path.lastVerifiedAt?.getTime()) return null
    const previous = current.health, transitioned = previous !== next, now = new Date()
    const run = await tx.verificationRun.create({ data: { pathId, health: next, reason: verdict.reason,
      confirmed: result.confirmed, trigger, videoUrl: result.videoUrl, gifUrl: result.gifUrl, createdAt: now,
      evidence: { steps: result.steps, failedStep: result.failedStep, finalUrl: result.finalUrl,
        attemptCount: result.attempts.length } as unknown as Prisma.InputJsonValue } })
    await tx.revenuePath.update({ where: { id: pathId }, data: { health: next, reason: verdict.reason,
      failedStep: result.failedStep, lastVerifiedAt: now, lastVerificationRunId: run.id, lastTransitionAt: transitioned ? now : current.lastTransitionAt,
      lastVideoUrl: result.videoUrl, lastGifUrl: result.gifUrl, lastScreenshotUrl: result.steps.at(-1)?.screenshotUrl ?? null,
      watchNextRunAt: new Date(now.getTime() + WATCH_MS), watchLeaseUntil: null,
      pulseNextRunAt: new Date(now.getTime() + PULSE_MS), pulseLeaseUntil: null } })
    const firstVerification = !shop.activationTrackedAt && hasEvidence
    await tx.shopifyShop.update({ where: { id: shop.id }, data: { lastProbeAt: now,
      activationTrackedAt: shop.activationTrackedAt ?? (hasEvidence ? now : null) } })
    if (transitioned && next === 'RED' && shop.projectId) await upsertIntegritySiteFlag({
      projectId: shop.projectId, pathId, pathLabel: current.label, storefrontUrl: current.storefrontUrl,
      health: next, reason: verdict.reason,
    }, tx)
    return { previous, transitioned, firstVerification, runId: run.id }
  })
  if (!published) {
    await deleteIntegrityRunArtifacts(namespace)
    return
  }
  const { previous, transitioned, firstVerification } = published

  if (firstVerification) {
    trackEvent('shopify_first_verification', {
      shop: path.shop.shopDomain,
      health: next,
      has_evidence: true,
    })
    trackEvent('shopify_monitoring_on', { shop: path.shop.shopDomain })
  }

  if (next === 'GREEN') {
    await enqueueIntegrityImprove(pathId).catch((error) => {
      logger.warn('Improve enqueue failed', {
        pathId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  if (transitioned && (next === 'RED' || (previous === 'RED' && next === 'GREEN'))) {
    await sendIntegrityAlert({ authority: path, runId: published.runId }).catch((error) => {
      logger.warn('Integrity alert failed', {
        pathId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }
}
