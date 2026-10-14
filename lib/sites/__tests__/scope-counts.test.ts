import { describe, expect, it } from 'vitest'
import { siteScopeCounts } from '../scope-counts'
import type { SiteFlagSeed } from '../coverage'

it('counts each finding once in its category and once per affected page', () => {
  const flags = [
    { id: 'one', area: 'search', pageUrl: 'https://example.com/', affectedPaths: ['https://example.com/', 'https://example.com/about', 'https://example.com/'] },
    { id: 'two', area: 'accessibility', pageUrl: 'https://example.com/', affectedPaths: [] },
  ] as SiteFlagSeed[]
  const counts = siteScopeCounts(flags, [{ url: 'https://example.com/', status: 'COMPLETED' }, { url: 'https://example.com/about', status: 'FAILED' }], 5)
  expect(counts).toMatchObject({ flags: 2, checkedPages: 1, recordedPages: 2, savedPages: 5, categories: { search: 1, accessibility: 1 }, pages: { 'https://example.com/': 2, 'https://example.com/about': 1 } })
})
describe('empty recorded coverage', () => {
  it('does not count saved inventory as checked pages', () => {
    expect(siteScopeCounts([], [], 5)).toMatchObject({ flags: 0, checkedPages: 0, recordedPages: 0, savedPages: 5 })
  })
})
