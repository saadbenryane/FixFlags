import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
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

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function checkR2Connection(): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 storage is not configured')
  await getR2Client().send(
    new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME! })
  )
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

  const key = `screenshots/${auditId}/${pageKey ? `${pageKey}-` : ''}${device}.png`
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
