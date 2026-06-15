import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import { getLocalScreenshotPath, uploadScreenshot } from '@/lib/storage/screenshots'

describe('screenshot storage', () => {
  it('getLocalScreenshotPath uses audit and device', () => {
    const p = getLocalScreenshotPath('audit-abc', 'desktop')
    assert.match(p, /audit-abc[\\/]desktop\.png$/)
  })

  it('uploadScreenshot writes local file in development', async () => {
    const prevEnv = process.env.NODE_ENV
    Reflect.set(process.env, 'NODE_ENV', 'development')
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    const auditId = `test-upload-${Date.now()}`
    const buffer = Buffer.from('fake-webp-bytes')

    const url = await uploadScreenshot(auditId, 'desktop', buffer)
    assert.equal(url, `http://localhost:3000/api/screenshots/${auditId}/desktop`)

    const filePath = getLocalScreenshotPath(auditId, 'desktop')
    const bytes = await fs.readFile(filePath)
    assert.equal(bytes.toString(), 'fake-webp-bytes')

    await fs.rm(path.dirname(filePath), { recursive: true, force: true })

    if (prevEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
    else Reflect.set(process.env, 'NODE_ENV', prevEnv)
  })
})
