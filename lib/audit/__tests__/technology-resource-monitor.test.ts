import { describe, expect, it, vi } from 'vitest'
import {
  MAX_TECHNOLOGY_RESOURCES,
  attachNetworkMonitor,
  sanitizeTechnologyResource,
} from '@/lib/audit/browser/network-monitor'
import type { Page } from 'playwright'

describe('technology resource sanitization', () => {
  it('retains only bounded host, path, type, and status', () => {
    expect(
      sanitizeTechnologyResource(
        'https://cdn.example.com/assets/app.js?token=secret#fragment',
        'script',
        200
      )
    ).toEqual({
      hostname: 'cdn.example.com',
      pathname: '/assets/app.js',
      resourceType: 'script',
      status: 200,
    })
  })

  it('rejects non-http resources', () => {
    expect(sanitizeTechnologyResource('data:text/plain,secret', 'other', 200)).toBeNull()
    expect(sanitizeTechnologyResource('blob:https://example.com/id', 'other', 200)).toBeNull()
  })

  it('keeps the resource inventory contract bounded', () => {
    expect(MAX_TECHNOLOGY_RESOURCES).toBe(300)
    const longPath = `https://example.com/${'a'.repeat(500)}?secret=yes`
    const sanitized = sanitizeTechnologyResource(longPath, 'script', 200)
    expect(sanitized?.pathname.length).toBeLessThanOrEqual(240)
    expect(JSON.stringify(sanitized)).not.toContain('secret')
  })

  it('deduplicates and caps resources without performing requests', () => {
    let onResponse: ((response: never) => void) | undefined
    const page = {
      on: vi.fn((event: string, callback: (response: never) => void) => {
        if (event === 'response') onResponse = callback
      }),
      off: vi.fn(),
    } as unknown as Page
    const monitor = attachNetworkMonitor(page, 'https://example.com')
    const response = (index: number) => ({
      url: () => `https://cdn.example.com/app-${index}.js?secret=${index}`,
      status: () => 200,
      ok: () => true,
      request: () => ({
        resourceType: () => 'script',
        method: () => 'GET',
      }),
    })

    for (let index = 0; index < 305; index += 1) {
      onResponse?.(response(index) as never)
    }
    onResponse?.(response(0) as never)

    expect(monitor.resources).toHaveLength(MAX_TECHNOLOGY_RESOURCES)
    expect(monitor.resourcesTruncated()).toBe(true)
    expect(new Set(monitor.resources.map((item) => item.pathname)).size).toBe(300)
    expect(JSON.stringify(monitor.resources)).not.toContain('secret')
  })
})
