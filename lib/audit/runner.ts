import { prisma } from '../db'
import { captureScreenshots } from './screenshot'
import { fetchAndParseMetadata, parseMetadataFromHtml, trimMetadataForStorage } from './metadata'
import { fetchPageSpeedData, toStoredPageSpeedResult } from './pagespeed'
import { runAllChecks, computeAreaScores } from './checks'
import { runJudge, isRetryableJudgeError } from './judge'
import { persistAuditResults } from './persist'
import { diffFindingsAgainstParent } from './diff-findings'
import { incrementUsageOnComplete } from './usage'
import { AUDIT_PROGRESS, setAuditProgress } from './progress'

export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)

  const url = audit.url

  // Clean partial results from a previous attempt
  await prisma.screenshot.deleteMany({ where: { auditId } })

  // Phase 1 — Capture screenshots + PageSpeed in parallel
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'CAPTURING',
      startedAt: new Date(),
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

  try {
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
  } catch (err) {
    console.error('Screenshot persist failed, continuing:', err)
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

  // Phase 2 — Deterministic checks
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

  // Phase 3 — AI judge (retry once on retryable errors)
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING', progress: AUDIT_PROGRESS.JUDGING },
  })

  let judgeOutput
  try {
    judgeOutput = await runJudge(
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
          errorMsg: `AI analysis unavailable: ${(firstErr as Error).message}`,
        },
      })
      throw firstErr
    }

    console.error('AI judge failed with retryable error, retrying once:', firstErr)
    try {
      judgeOutput = await runJudge(
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
          errorMsg: `AI analysis unavailable: ${(secondErr as Error).message}`,
        },
      })
      throw secondErr
    }
  }

  await persistAuditResults(auditId, judgeOutput, deterministicFindings, areaScores)

  if (audit.parentId) {
    await diffFindingsAgainstParent(auditId, audit.parentId)
  }

  if (audit.userId) {
    await incrementUsageOnComplete(audit.userId)
  }
}
