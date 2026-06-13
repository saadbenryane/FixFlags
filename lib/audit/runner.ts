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
import { persistAuditRunCost } from '@/lib/billing/costs'
import { isR2Configured } from '@/lib/storage/r2'

function sanitizeAuditErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function runPostCompletionSteps(
  auditId: string,
  audit: { userId: string | null; parentId: string | null },
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
  }

  if (audit.userId) {
    try {
      await incrementUsageOnCompleteForAudit(auditId, audit.userId)
    } catch (err) {
      console.error(`Post-completion usage increment failed for audit ${auditId}:`, err)
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

  // Clean partial results from a previous attempt
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

  if (isR2Configured()) {
    if (!screenshots.desktopUrl || !screenshots.mobileUrl) {
      const msg =
        'Screenshot storage failed. Check R2 configuration (R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT).'
      await prisma.audit.update({
        where: { id: auditId },
        data: { status: 'FAILED', errorMsg: msg },
      })
      throw new Error(msg)
    }
  }

  if (screenshots.desktopUrl) {
    await prisma.screenshot.create({
      data: {
        auditId,
        device: 'DESKTOP',
        url: screenshots.desktopUrl,
        width: 1280,
        height: 900,
      },
    })
    await setAuditProgress(auditId, AUDIT_PROGRESS.DESKTOP_SCREENSHOT)
  }
  if (screenshots.mobileUrl) {
    await prisma.screenshot.create({
      data: {
        auditId,
        device: 'MOBILE',
        url: screenshots.mobileUrl,
        width: 375,
        height: 812,
      },
    })
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

  const storedPerformance = {
    desktop: pagespeed.desktop ? toStoredPageSpeedResult(pagespeed.desktop) : null,
    mobile: pagespeed.mobile ? toStoredPageSpeedResult(pagespeed.mobile) : null,
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

  const deterministicFindings = await runAllChecks(
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
    { userId: audit.userId, parentId: audit.parentId },
    judgeResult,
    durationMs,
    pagespeedCalls
  )
}
