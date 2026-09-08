import fs from 'fs/promises'
import path from 'path'
import { getAppUrl } from '@/lib/get-app-url'
import { isR2Configured, getScreenshotBytes } from '@/lib/storage/r2'
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const LOCAL_DIR = path.join(process.cwd(), '.data', 'integrity')

function r2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint:
      process.env.R2_S3_ENDPOINT ||
      `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export function integrityObjectKey(runId: string, filename: string): string {
  return `integrity/${runId}/${filename}`
}

export async function uploadIntegrityArtifact(
  runId: string,
  filename: string,
  bytes: Buffer,
  contentType: string
): Promise<{ key: string; url: string; localPath: string | null }> {
  const key = integrityObjectKey(runId, filename)
  if (process.env.NODE_ENV === 'production' && isR2Configured()) {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    )
    return {
      key,
      url: `${getAppUrl()}/api/integrity-assets/${runId}/${encodeURIComponent(filename)}`,
      localPath: null,
    }
  }

  const dir = path.join(LOCAL_DIR, runId)
  await fs.mkdir(dir, { recursive: true })
  const localPath = path.join(dir, filename)
  await fs.writeFile(localPath, bytes)
  return {
    key,
    url: `${getAppUrl()}/api/integrity-assets/${runId}/${encodeURIComponent(filename)}`,
    localPath,
  }
}

export async function deleteIntegrityPrefix(runId: string): Promise<void> {
  const dir = path.join(LOCAL_DIR, runId)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
}

export async function readIntegrityArtifact(
  runId: string,
  filename: string
): Promise<Buffer | null> {
  const key = integrityObjectKey(runId, filename)
  if (process.env.NODE_ENV === 'production' && isR2Configured()) {
    return getScreenshotBytes(key)
  }
  try {
    return await fs.readFile(path.join(LOCAL_DIR, runId, filename))
  } catch {
    return null
  }
}
