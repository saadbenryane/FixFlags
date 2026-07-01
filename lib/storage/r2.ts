import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  )
}

/**
 * When set, use a custom S3-compatible endpoint (e.g. a Railway bucket) instead
 * of Cloudflare R2. Leave unset to use Cloudflare R2 exactly as before.
 */
function getS3Endpoint(): string {
  return (
    process.env.R2_S3_ENDPOINT ||
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  )
}

/**
 * Path-style addressing (`https://host/bucket/key`) vs virtual-host
 * (`https://bucket.host/key`). Cloudflare R2 and Railway buckets both use
 * virtual-host, so this defaults off; set R2_FORCE_PATH_STYLE=true only for a
 * store that requires path-style (e.g. some MinIO setups).
 */
function forcePathStyle(): boolean {
  return process.env.R2_FORCE_PATH_STYLE === 'true'
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: getS3Endpoint(),
    forcePathStyle: forcePathStyle(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

/** Object key for a screenshot. Shared by upload and read so they stay in sync. */
export function getScreenshotKey(
  auditId: string,
  device: string,
  pageKey?: string | null
): string {
  return `screenshots/${auditId}/${pageKey ? `${pageKey}-` : ''}${device}.png`
}

export async function checkR2Connection(): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 storage is not configured')
  await getR2Client().send(
    new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME! })
  )
}

/**
 * Fetch a stored object's bytes. Railway buckets (and private R2 buckets) are
 * not publicly readable, so screenshots are streamed back through the app's
 * access-controlled /api/screenshots route rather than a public URL. Returns
 * null if the object does not exist.
 */
export async function getScreenshotBytes(key: string): Promise<Buffer | null> {
  if (!isR2Configured()) throw new Error('R2 storage is not configured')
  try {
    const res = await getR2Client().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
    )
    if (!res.Body) return null
    const bytes = await res.Body.transformToByteArray()
    return Buffer.from(bytes)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'NoSuchKey' || err.name === 'NotFound')
    ) {
      return null
    }
    throw err
  }
}

export async function uploadScreenshot(
  auditId: string,
  device: 'desktop' | 'mobile',
  imageBuffer: Buffer,
  pageKey?: string | null
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error('R2 storage is not configured')
  }

  const key = getScreenshotKey(auditId, device, pageKey)
  const r2 = getR2Client()

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    })
  )

  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function deleteAuditScreenshots(auditIds: string[]): Promise<void> {
  if (auditIds.length === 0) return
  if (!isR2Configured()) throw new Error('R2 storage is not configured')
  const r2 = getR2Client()
  const objects: Array<{ Key: string }> = []
  for (const auditId of auditIds) {
    let continuationToken: string | undefined
    do {
      const listed = await r2.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME!,
          Prefix: `screenshots/${auditId}/`,
          ContinuationToken: continuationToken,
        })
      )
      for (const object of listed.Contents ?? []) {
        if (object.Key) objects.push({ Key: object.Key })
      }
      continuationToken = listed.NextContinuationToken
    } while (continuationToken)
  }
  for (let index = 0; index < objects.length; index += 1_000) {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Delete: { Objects: objects.slice(index, index + 1_000), Quiet: true },
      })
    )
  }
}
