export async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) return ''
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let length = 0
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break
      length += chunk.value.byteLength
      if (length > limit) { await reader.cancel(); throw new Error('Message exceeds size limit') }
      chunks.push(chunk.value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally { reader.releaseLock() }
}
