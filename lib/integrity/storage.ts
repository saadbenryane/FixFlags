import fs from 'fs/promises'
import path from 'path'
import { getAppUrl } from '@/lib/get-app-url'
import { pathIdForArtifactNamespace } from './artifact-namespace'
import { putPrivateObject, getPrivateObjectBytes, deletePrivateObjectPrefixes, type StorageRequestOptions } from '@/lib/storage/r2'

const LOCAL_DIR = path.join(process.cwd(), '.data', 'integrity')

export function integrityObjectKey(runId: string, filename: string): string {
  return `integrity/${runId}/${filename}`
}

export async function uploadIntegrityArtifact(
  runId: string,
  filename: string,
  bytes: Buffer,
  contentType: string,
  options: StorageRequestOptions = {},
): Promise<{ key: string; url: string; localPath: string | null }> {
  const key = integrityObjectKey(runId, filename)
  if (process.env.NODE_ENV === 'production') {
    await putPrivateObject(key, bytes, contentType, options)
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

/** A rejected publisher removes its own attempt, never a replacement run. */
export async function deleteIntegrityRunArtifacts(runId: string, options: StorageRequestOptions = {}): Promise<void> {
  if (!pathIdForArtifactNamespace(runId)) throw new Error('A scoped integrity run ID is required')
  if (process.env.NODE_ENV === 'production') {
    await deletePrivateObjectPrefixes([`integrity/${runId}/`], options)
  } else {
    await fs.rm(path.join(LOCAL_DIR, runId), { recursive: true, force: true })
  }
}

/** A path owns every timestamped attempt, including media whose receipt was lost. */
export async function deleteIntegrityPathArtifacts(pathIds: string[], options: StorageRequestOptions = {}): Promise<void> {
  if (!pathIds.length) return
  if (pathIds.some(id => !/^[a-zA-Z0-9]+$/.test(id))) throw new Error('A canonical integrity path ID is required')
  const prefixes = pathIds.map(id => `path-${id}-`)
  if (process.env.NODE_ENV === 'production') {
    await deletePrivateObjectPrefixes(prefixes.map(prefix => `integrity/${prefix}`), options)
    return
  }
  let entries
  try { entries = await fs.readdir(LOCAL_DIR, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
  for (const entry of entries) {
    if (entry.isDirectory() && prefixes.some(prefix => entry.name.startsWith(prefix))) {
      await fs.rm(path.join(LOCAL_DIR, entry.name), { recursive: true, force: true })
    }
  }
}

export async function readIntegrityArtifact(
  runId: string,
  filename: string,
  options: StorageRequestOptions = {},
): Promise<Buffer | null> {
  const key = integrityObjectKey(runId, filename)
  if (process.env.NODE_ENV === 'production') {
    return getPrivateObjectBytes(key, options)
  }
  try {
    return await fs.readFile(path.join(LOCAL_DIR, runId, filename))
  } catch {
    return null
  }
}
