import fs from 'fs/promises'
import path from 'path'
import {
  uploadScreenshot as uploadToR2,
  isR2Configured,
  getScreenshotKey,
  getScreenshotBytes,
} from './r2'
import { deleteAuditScreenshots as deleteFromR2 } from './r2'
import {
  StorageNotConfiguredError,
  StorageUploadError,
} from '@/lib/audit/pipeline-errors'

const LOCAL_SCREENSHOTS_DIR = path.join(process.cwd(), '.data', 'screenshots')

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  if (!url) {
    // CLI scripts (tsx) and tests don't load .env.local, so the local screenshot
    // API is unreachable by env. In non-production we can safely assume the dev
    // origin; production still throws because R2 is required there.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_URL (or BETTER_AUTH_URL) is required for local screenshot storage'
      )
    }
    return 'http://localhost:3000'
  }
  return url.replace(/\/$/, '')
}

export function getLocalScreenshotPath(
  auditId: string,
  device: string,
  pageKey?: string | null
): string {
  const filename = pageKey ? `${pageKey}-${device}.png` : `${device}.png`
  return path.join(LOCAL_SCREENSHOTS_DIR, auditId, filename)
}

/**
 * Persist screenshot bytes and return the URL the report renders.
 *
 * In both production and dev the URL points at the app's access-controlled
 * /api/screenshots route — object stores (Railway bucket / private R2) are not
 * publicly readable, so bytes are streamed back through the app rather than
 * served from a public bucket URL. Only the backing store differs: the bucket
 * in production, local disk in dev.
 */
export async function uploadScreenshot(
  auditId: string,
  device: 'desktop' | 'mobile',
  imageBuffer: Buffer,
  pageKey?: string | null
): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    if (!isR2Configured()) {
      throw new StorageNotConfiguredError(
        'R2 storage is not configured. Set R2_BUCKET_NAME, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL.'
      )
    }
    try {
      await uploadToR2(auditId, device, imageBuffer, pageKey)
    } catch (err) {
      throw new StorageUploadError(
        `Failed to upload ${device} screenshot to R2: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      )
    }
  } else {
    const dir = path.join(LOCAL_SCREENSHOTS_DIR, auditId)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(getLocalScreenshotPath(auditId, device, pageKey), imageBuffer)
  }

  const query = pageKey ? `?page=${encodeURIComponent(pageKey)}` : ''
  return `${getAppBaseUrl()}/api/screenshots/${auditId}/${device}${query}`
}

/**
 * Read stored screenshot bytes for the /api/screenshots route: the bucket in
 * production, local disk in dev. Returns null when the object is absent.
 */
export async function readScreenshot(
  auditId: string,
  device: string,
  pageKey?: string | null
): Promise<Buffer | null> {
  if (process.env.NODE_ENV === 'production') {
    return getScreenshotBytes(getScreenshotKey(auditId, device, pageKey))
  }
  try {
    return await fs.readFile(getLocalScreenshotPath(auditId, device, pageKey))
  } catch {
    return null
  }
}

export async function deleteAuditScreenshotAssets(auditIds: string[]): Promise<void> {
  if (auditIds.length === 0) return
  if (process.env.NODE_ENV === 'production') {
    await deleteFromR2(auditIds)
    return
  }
  await Promise.all(
    auditIds.map((auditId) =>
      fs.rm(path.join(LOCAL_SCREENSHOTS_DIR, auditId), {
        recursive: true,
        force: true,
      })
    )
  )
}
