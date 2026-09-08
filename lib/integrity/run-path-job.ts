import { IntegrityHealth, type Prisma } from '@prisma/client'
import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { runPathProbe } from './run-path-probe'
import { sendIntegrityAlert } from './alerts'
import { enqueueIntegrityImprove } from './enqueue'

const WATCH_MS = 6 * 60 * 60 * 1000
const PULSE_MS = 15 * 60 * 1000

export async function runIntegrityPathJob(pathId: string, trigger: string): Promise<void> {
  const path = await prisma.revenuePath.findUnique({
    where: { id: pathId },
    include: { shop: true },
  })
  if (!path || path.shop.uninstalledAt) return

  const result = await runPathProbe({
    runId: `path-${pathId}-${Date.now()}`,
    url: path.storefrontUrl,
    allowLocalhost:
      process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_SHOPIFY_FIXTURE === '1',
  })

  const previous = path.health
  const next = result.health as IntegrityHealth
  const transitioned = previous !== next
  const hasEvidence = Boolean(result.videoUrl || result.gifUrl || result.steps.some((step) => step.screenshotUrl))
  const firstVerification = !path.shop.activationTrackedAt && hasEvidence

  await prisma.$transaction([
    prisma.verificationRun.create({
      data: {
        pathId,
        health: next,
        reason: result.reason,
        confirmed: result.confirmed,
        trigger,
        videoUrl: result.videoUrl,
        gifUrl: result.gifUrl,
        evidence: {
          steps: result.steps,
          failedStep: result.failedStep,
          finalUrl: result.finalUrl,
        } as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.revenuePath.update({
      where: { id: pathId },
      data: {
        health: next,
        reason: result.reason,
        failedStep: result.failedStep,
        lastVerifiedAt: new Date(),
        lastTransitionAt: transitioned ? new Date() : path.lastTransitionAt,
        lastVideoUrl: result.videoUrl,
        lastGifUrl: result.gifUrl,
        lastScreenshotUrl: result.steps.at(-1)?.screenshotUrl ?? path.lastScreenshotUrl,
        watchNextRunAt: new Date(Date.now() + WATCH_MS),
        watchLeaseUntil: null,
        pulseNextRunAt: new Date(Date.now() + PULSE_MS),
        pulseLeaseUntil: null,
      },
    }),
    prisma.shopifyShop.update({
      where: { id: path.shopId },
      data: {
        lastProbeAt: new Date(),
        activationTrackedAt:
          path.shop.activationTrackedAt ?? (hasEvidence ? new Date() : path.shop.activationTrackedAt),
      },
    }),
  ])

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
    await sendIntegrityAlert({
      shop: path.shop,
      pathLabel: path.label,
      health: next,
      reason: result.reason,
      videoUrl: result.videoUrl,
      gifUrl: result.gifUrl,
      screenshotUrl: result.steps.at(-1)?.screenshotUrl ?? null,
    }).catch((error) => {
      logger.warn('Integrity alert failed', {
        pathId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }
}
