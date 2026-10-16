import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

export type StorageRequestOptions = { deadline?: number; signal?: AbortSignal }

/** One budget covers signing, retries, transfer and body consumption. Each
 * operation owns its client and closes its sockets on completion or refusal. */
async function withinStorageBudget<T>(options: StorageRequestOptions, work: (client: S3Client, signal: AbortSignal) => Promise<T>, timeoutMs = 10_000): Promise<T> {
  if (!isR2Configured()) throw new Error('R2 storage is not configured')
  const controller = new AbortController()
  const expired = Object.assign(new Error('Private capture storage deadline exceeded'), { name: 'TimeoutError', code: 'ETIMEDOUT' })
  const remaining = Math.min(timeoutMs, (options.deadline ?? Infinity) - Date.now())
  options.signal?.throwIfAborted()
  if (!(remaining > 0)) throw expired
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(expired), remaining)
  timer.unref?.()
  let client: S3Client | undefined
  try {
    client = getR2Client()
    const result = await work(client, controller.signal)
    controller.signal.throwIfAborted()
    return result
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    client?.destroy()
  }
}

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

export async function checkR2Connection(options: StorageRequestOptions = {}): Promise<void> {
  await withinStorageBudget(options, (client, signal) => client.send(
    new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME! }), { abortSignal: signal }
  ))
}

/**
 * Fetch a stored object's bytes. Railway buckets (and private R2 buckets) are
 * not publicly readable, so screenshots are streamed back through the app's
 * access-controlled /api/screenshots route rather than a public URL. Returns
 * null if the object does not exist.
 */
export async function getPrivateObjectBytes(key: string, options: StorageRequestOptions = {}): Promise<Buffer | null> {
  return withinStorageBudget(options, async (client, signal) => {
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }), { abortSignal: signal }
      )
      const body = res.Body
      if (!body) return null
      const reading = body.transformToByteArray()
      const abort = () => { if (body instanceof Readable) body.destroy(signal.reason) }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      try { return Buffer.from(await reading) }
      finally { signal.removeEventListener('abort', abort) }
    } catch (err) {
      if (err instanceof Error && (err.name === 'NoSuchKey' || err.name === 'NotFound')) return null
      throw err
    }
  })
}

export { getPrivateObjectBytes as getScreenshotBytes }

export async function putPrivateObject(key: string, bytes: Buffer, contentType: string,
  options: StorageRequestOptions = {}): Promise<void> {
  await withinStorageBudget(options, (client, signal) => client.send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, Body: bytes,
      ContentType: contentType, CacheControl: 'private, no-store' }), { abortSignal: signal }
  ))
}

export async function uploadScreenshot(
  auditId: string,
  device: 'desktop' | 'mobile',
  imageBuffer: Buffer,
  pageKey?: string | null,
  options: StorageRequestOptions = {},
): Promise<string> {
  const key = getScreenshotKey(auditId, device, pageKey)
  await putPrivateObject(key, imageBuffer, 'image/png', options)

  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function deleteAuditScreenshots(auditIds: string[], options: StorageRequestOptions = {}): Promise<void> {
  await deletePrivateObjectPrefixes(auditIds.map(id => `screenshots/${id}/`), options)
}

export async function deletePrivateObjectPrefixes(prefixes: string[], options: StorageRequestOptions = {}): Promise<void> {
  if (prefixes.length === 0) return
  if (prefixes.some(prefix => !prefix || prefix === '/')) throw new Error('A scoped private object prefix is required')
  await withinStorageBudget(options, async (r2, signal) => {
    const objects: Array<{ Key: string }> = []
    for (const prefix of prefixes) {
      let continuationToken: string | undefined
      do {
        const listed = await r2.send(
          new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME!,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }), { abortSignal: signal }
        )
        for (const object of listed.Contents ?? []) {
          if (object.Key) objects.push({ Key: object.Key })
        }
        continuationToken = listed.NextContinuationToken
      } while (continuationToken)
    }
    for (let index = 0; index < objects.length; index += 1_000) {
      const deleted = await r2.send(
        new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Delete: { Objects: objects.slice(index, index + 1_000), Quiet: true },
        }), { abortSignal: signal }
      )
      if (deleted.Errors?.length) throw new Error(`Private capture deletion failed for ${deleted.Errors.length} objects. Customer data is retained for reconciliation.`)
    }
  }, 30_000)
}
