import { describe, expect, it } from 'vitest'
import { adminPagination, readAdminListQuery } from '@/lib/admin/list-query'

describe('admin list queries', () => {
  it.each(['-1', '0', '1.5', 'NaN', 'Infinity', '9007199254740992'])(
    'rejects invalid page %s',
    (page) => {
      expect(readAdminListQuery({ page }).page).toBe(1)
    },
  )
  it('bounds and trims search text', () => {
    expect(readAdminListQuery({ q: ' alice@example.com ', page: '2' })).toEqual({
      q: 'alice@example.com',
      page: 2,
    })
    expect(readAdminListQuery({ q: 'x'.repeat(300) }).q).toHaveLength(200)
  })
  it('reaches records after the former 200-record limit', () => {
    expect(adminPagination(5, 251)).toEqual({ page: 5, pages: 6, skip: 200, take: 50 })
  })
  it('clamps stale pages after a filter reduces the results', () => {
    expect(adminPagination(99, 12)).toEqual({ page: 1, pages: 1, skip: 0, take: 50 })
    expect(adminPagination(99, 0)).toEqual({ page: 1, pages: 1, skip: 0, take: 50 })
  })
})
