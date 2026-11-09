import { constants } from 'node:fs'
import { open } from 'node:fs/promises'

const MAX_FILE_BYTES = 16 * 1024 * 1024

export async function readReportJson(path: string): Promise<unknown> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const stats = await file.stat()
    if (!stats.isFile() || !stats.size || stats.size > MAX_FILE_BYTES) throw new Error('Invalid report input file')
    const buffer = Buffer.alloc(stats.size + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset)
      if (!bytesRead) break
      offset += bytesRead
    }
    if (offset !== stats.size) throw new Error('Report input changed during read')
    return JSON.parse(buffer.toString('utf8', 0, offset))
  } finally {
    await file.close()
  }
}
