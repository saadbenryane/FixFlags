import { prisma } from '../db'
import { captureScreenshots } from './screenshot'
import { fetchAndParseMetadata, parseMetadataFromHtml, trimMetadataForStorage } from './metadata'
import { fetchPageSpeedData, toStoredPageSpeedResult } from './pagespeed'
import { runAllChecks, computeAreaScores } from './checks'
import { runJudge, isRetryableJudgeError } from './judge'
import { persistAuditResults } from './persist'
import { diffFindingsAgainstParent } from './diff-findings'
import { incrementUsageOnCompleteForAudit } from './usage'
import { AUDIT_PROGRESS, setAuditProgress } from './progress'
import { validateAndRepairJudgeOutput } from './validate-judge-output'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { discoverCriticalPathUrls } from './critical-path'
import { applyDeterministicVerification } from './verify-findings'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'

function sanitizeAuditErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function runPostCompletionSteps(
  auditId: string,
  audit: { userId: string | null; parentId: string | null; skipUsageCount?: boolean; trialRecheck?: boolean },
  judgeResult: {
    usage: { inputTokens: number; outputTokens: number; model: string }
  },
  durationMs: number,
  pagespeedCalls: number
): Promise<void> {
  try {
    await persistAuditRunCost(auditId, {
      durationMs,
      llmInputTokens: judgeResult.usage.inputTokens,
      llmOutputTokens: judgeResult.usage.outputTokens,
      llmModel: judgeResult.usage.model,
      pagespeedCalls,
    })
  } catch (err) {
    console.error(`Post-completion cost persist failed for audit ${auditId}:`, err)
  }

  if (audit.parentId) {
    try {
      await diffFindingsAgainstParent(auditId, audit.parentId)
    } catch (err) {
      console.error(`Post-completion diff failed for audit ${auditId}:`, err)
    }
    try {
      const parent = await prisma.audit.findUnique({
        where: { id: audit.parentId },
        select: { url: true },
      })
      if (parent?.url) {
        await applyDeterministicVerification(auditId, audit.parentId, parent.url)
      }
    } catch (err) {
      console.error(`Deterministic verification failed for audit ${auditId}:`, err)
    }
  }

  if (audit.userId) {
    try {
      await incrementUsageOnCompleteForAudit(auditId, audit.userId)
    } catch (err) {
      console.error(`Post-completion usage increment failed for audit ${auditId}:`, err)
    }
  }

  if (audit.trialRecheck && audit.parentId && audit.userId) {
    try {
      const { consumeTrialRecheckOnSuccess } = await import('@/lib/auth/entitlements')
      await consumeTrialRecheckOnSuccess(audit.userId)
    } catch (err) {
      console.error(`Trial recheck consumption failed for audit ${auditId}:`, err)
    }
  }
}

export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)

  if (audit.status === 'COMPLETED') {
    console.log(`Audit ${auditId} already completed — skipping worker retry`)
    return
  }

  const url = audit.url

  await prisma.screenshot.deleteMany({ where: { auditId } })

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'CAPTURING',
      startedAt: audit.startedAt ?? new Date(),
      errorMsg: null,
      progress: AUDIT_PROGRESS.CAPTURING,
    },
  })

  let desktopBase64: string | null = null
  let mobileBase64: string | null = null
  let consoleErrors: Array<{ type: string; text: string }> = []

  const [screenshots, pagespeed] = await Promise.all([
    captureScreenshots(url, auditId),
    fetchPageSpeedData(url),
  ])

  desktopBase64 = screenshots.desktopBase64
  mobileBase64 = screenshots.mobileBase64
  consoleErrors = screenshots.consoleErrors

  const pagespeedCalls =
    (pagespeed.desktop ? 1 : 0) + (pagespeed.mobile ? 1 : 0)

  if (!screenshots.desktopUrl) {
    const msg =
      'Desktop screenshot capture failed. The site may be unreachable or blocking automated access.'
    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'FAILED', errorMsg: msg },
    })
    throw new Error(msg)
  }

  if (!screenshots.mobileUrl && screenshots.captureStatus.mobile === 'failed') {
    console.warn(`Audit ${auditId}: mobile screenshot capture failed — continuing with desktop only`)
  }

  await prisma.screenshot.create({
    data: {
      auditId,
      device: 'DESKTOP',
      url: screenshots.desktopUrl,
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    },
  })
  await setAuditProgress(auditId, AUDIT_PROGRESS.DESKTOP_SCREENSHOT)

  if (screenshots.mobileUrl) {
    await prisma.screenshot.create({
      data: {
        auditId,
        device: 'MOBILE',
        url: screenshots.mobileUrl,
        width: MOBILE_VIEWPORT.width,
        height: MOBILE_VIEWPORT.height,
      },
    })
    await setAuditProgress(auditId, AUDIT_PROGRESS.MOBILE_SCREENSHOT)
  }

  let metadata
  try {
    metadata = screenshots.desktopHtml
      ? parseMetadataFromHtml(screenshots.desktopHtml, url)
      : await fetchAndParseMetadata(url)
  } catch (err) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'FAILED',
        errorMsg: `Failed to fetch page: ${(err as Error).message}`,
      },
    })
    throw err
  }

  const storedPerformance: Record<string, unknown> = {
    desktop: pagespeed.desktop ? toStoredPageSpeedResult(pagespeed.desktop) : null,
    mobile: pagespeed.mobile ? toStoredPageSpeedResult(pagespeed.mobile) : null,
    desktopError: pagespeed.desktopError ?? null,
    mobileError: pagespeed.mobileError ?? null,
    screenshots: screenshots.captureStatus,
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'CHECKING',
      progress: AUDIT_PROGRESS.METADATA_FETCHED,
      htmlMetadata: trimMetadataForStorage(metadata) as never,
      performanceData: storedPerformance as never,
      consoleErrors: consoleErrors as never,
    },
  })

  let deterministicFindings = await runAllChecks(
    url,
    metadata,
    pagespeed.desktop,
    pagespeed.mobile,
    consoleErrors,
    (index) => {
      const progress =
        AUDIT_PROGRESS.METADATA_FETCHED +
        (index + 1) * AUDIT_PROGRESS.CHECKING_STEP
      void setAuditProgress(auditId, progress)
    }
  )

  if (audit.auditMode === 'CRITICAL_PATH') {
    const criticalUrls = discoverCriticalPathUrls(url, metadata)
    for (const pageUrl of criticalUrls.slice(1)) {
      try {
        const pageMeta = await fetchAndParseMetadata(pageUrl)
        const pageFindings = await runAllChecks(pageUrl, pageMeta, null, null, [])
        for (const finding of pageFindings) {
          deterministicFindings.push({ ...finding, pageUrl })
        }
      } catch (err) {
        console.warn(`Critical path page ${pageUrl} failed:`, err)
      }
    }
  }

  const areaScores = computeAreaScores(deterministicFindings, pagespeed.desktop, pagespeed.mobile)

  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING', progress: AUDIT_PROGRESS.JUDGING },
  })

  let judgeResult
  try {
    judgeResult = await runJudge(
      url,
      metadata,
      pagespeed.desktop,
      pagespeed.mobile,
      deterministicFindings,
      desktopBase64,
      mobileBase64
    )
  } catch (firstErr) {
    if (!isRetryableJudgeError(firstErr)) {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'FAILED',
          errorMsg: `AI analysis unavailable: ${sanitizeAuditErrorMessage((firstErr as Error).message)}`,
        },
      })
      throw firstErr
    }

    console.error('AI judge failed with retryable error, retrying once:', firstErr)
    try {
      judgeResult = await runJudge(
        url,
        metadata,
        pagespeed.desktop,
        pagespeed.mobile,
        deterministicFindings,
        desktopBase64,
        mobileBase64
      )
    } catch (secondErr) {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'FAILED',
          errorMsg: `AI analysis unavailable: ${sanitizeAuditErrorMessage((secondErr as Error).message)}`,
        },
      })
      throw secondErr
    }
  }

  judgeResult.output = validateAndRepairJudgeOutput(
    judgeResult.output,
    deterministicFindings
  )

  await persistAuditResults(auditId, judgeResult.output, deterministicFindings, areaScores)

  const finished = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { startedAt: true, completedAt: true },
  })
  const durationMs =
    finished?.startedAt && finished?.completedAt
      ? finished.completedAt.getTime() - finished.startedAt.getTime()
      : 0

  await runPostCompletionSteps(
    auditId,
    {
      userId: audit.userId,
      parentId: audit.parentId,
      skipUsageCount: audit.skipUsageCount,
      trialRecheck: audit.trialRecheck,
    },
    judgeResult,
    durationMs,
    pagespeedCalls
  )
}
