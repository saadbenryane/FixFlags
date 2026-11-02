/** Read either supported MCP response encoding and stop at this call's reply. */
export async function readMcpResponse(response: Response, requestId?: string | number | null): Promise<unknown> {
  if (!response.body) return null
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', data: string[] = []
  const event = () => {
    if (!data.length) return undefined
    const value = JSON.parse(data.join('\n')) as { id?: unknown }
    data = []
    return value && typeof value === 'object' && value.id === requestId ? value : undefined
  }
  try {
    for (;;) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (!line) {
          const reply = event()
          if (reply !== undefined) return reply
        } else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (chunk.done) {
        if (buffer.startsWith('data:')) data.push(buffer.slice(5).replace(/^ /, ''))
        return event() ?? null
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
