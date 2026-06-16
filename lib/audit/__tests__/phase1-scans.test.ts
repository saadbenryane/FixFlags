import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePreviewMeta, truncatePreview } from '@/lib/audit/preview-meta'
import { parseFlowData } from '@/lib/audit/flow-data'

describe('parsePreviewMeta', () => {
  it('extracts title and og fields from htmlMetadata', () => {
    const result = parsePreviewMeta(
      {
        title: 'FixFlags',
        description: 'QA for AI sites',
        ogTitle: 'FixFlags OG',
        ogDescription: 'Share desc',
        ogImage: 'https://example.com/og.png',
      },
      'https://example.com'
    )
    assert.equal(result?.title, 'FixFlags')
    assert.equal(result?.ogImage, 'https://example.com/og.png')
    assert.equal(result?.ogImageOk, true)
  })

  it('marks ogImageOk false when explicitly set', () => {
    const result = parsePreviewMeta(
      { ogImage: 'https://example.com/broken.png' },
      'https://example.com',
      { ogImageOk: false }
    )
    assert.equal(result?.ogImageOk, false)
  })

  it('returns null for invalid metadata', () => {
    assert.equal(parsePreviewMeta(null, 'https://example.com'), null)
  })
})

describe('truncatePreview', () => {
  it('truncates long strings', () => {
    assert.equal(truncatePreview('a'.repeat(70), 60).length, 60)
  })
})

describe('parseFlowData', () => {
  it('parses flow steps from audit JSON', () => {
    const result = parseFlowData({
      status: 'success',
      finalUrl: 'https://example.com/signup',
      ctaText: 'Get started',
      steps: [
        { label: 'Landing', url: 'https://example.com', screenshotUrl: '/a.png' },
      ],
    })
    assert.equal(result?.status, 'success')
    assert.equal(result?.steps.length, 1)
    assert.equal(result?.ctaText, 'Get started')
  })
})
