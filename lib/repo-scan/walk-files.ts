import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ScannedFile } from '@/lib/audit/code-checks/types'
import {
  MAX_FILES_SCANNED,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_BYTES_SCANNED,
  SKIPPED_DIR_NAMES,
  isLikelyBinaryPath,
} from './constants'

/** Walks a checked-out repo tree, returning text files within the configured caps. */
export async function walkScannableFiles(rootDir: string): Promise<ScannedFile[]> {
  const files: ScannedFile[] = []
  let totalBytes = 0

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES_SCANNED || totalBytes >= MAX_TOTAL_BYTES_SCANNED) return

    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (files.length >= MAX_FILES_SCANNED || totalBytes >= MAX_TOTAL_BYTES_SCANNED) return

      if (entry.isDirectory()) {
        if (SKIPPED_DIR_NAMES.has(entry.name)) continue
        await walk(join(dir, entry.name))
        continue
      }

      if (!entry.isFile()) continue

      const fullPath = join(dir, entry.name)
      const path = relative(rootDir, fullPath).split('\\').join('/')
      if (isLikelyBinaryPath(path)) continue

      const stats = await stat(fullPath)
      if (stats.size === 0 || stats.size > MAX_FILE_SIZE_BYTES) continue
      if (totalBytes + stats.size > MAX_TOTAL_BYTES_SCANNED) continue

      const content = await readFile(fullPath, 'utf8').catch(() => null)
      if (content === null || content.includes('\0')) continue

      files.push({ path, content })
      totalBytes += stats.size
    }
  }

  await walk(rootDir)
  return files
}
