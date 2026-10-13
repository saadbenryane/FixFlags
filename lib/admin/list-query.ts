export const ADMIN_PAGE_SIZE = 50

export function readAdminListQuery(params: { q?: string; page?: string }) {
  const parsed = Number(params.page)
  return {
    q: (params.q ?? '').trim().slice(0, 200),
    page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
  }
}

export function adminPagination(requestedPage: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))
  const page = Math.min(requestedPage, pages)
  return { page, pages, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }
}
