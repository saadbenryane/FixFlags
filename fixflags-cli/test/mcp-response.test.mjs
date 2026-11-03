import assert from 'node:assert/strict'
import test from 'node:test'
import { readMcpResponse } from '../dist/mcp-response.js'

test('streamed replies survive split UTF-8, multiline data, progress and unrelated call events', async () => {
  const expected = { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'Café action' }] } }
  const body = Buffer.from(': keepalive\r\n\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\r\n\r\n' +
    'data: {"jsonrpc":"2.0","id":6,"result":{}}\r\n\r\n' +
    'event: message\r\ndata: {"jsonrpc":"2.0",\r\ndata: "id":7,"result":{"content":[{"type":"text","text":"Café action"}]}}\r\n\r\n')
  let cancelled = false, index = 0
  const response = new Response(new ReadableStream({
    pull(controller) {
      if (index < body.length) controller.enqueue(body.subarray(index, ++index))
      else controller.close()
    },
    cancel() { cancelled = true },
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8' } })
  assert.deepEqual(await readMcpResponse(response, 7), expected)
  assert.equal(cancelled, true)
})

test('empty notification acknowledgements do not invent a reply', async () => {
  assert.equal(await readMcpResponse(new Response(null, { status: 202 })), null)
})
