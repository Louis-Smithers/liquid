import { useEffect, useState } from "react"

/**
 * Client-side pagination slice math, extracted from ClientsPage's original inline pattern.
 * Caller passes the already-filtered/sorted array; hook returns the current page's slice
 * plus page state and controls. Automatically clamps `page` back into range if the list
 * shrinks (e.g. a filter removes rows) so you don't get stuck on an empty page.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(items.length / pageSize)
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize)

  // Clamp page into range if the underlying list shrinks below the current page.
  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [totalPages, page])

  return {
    page,
    setPage,
    totalPages,
    pageItems,
    goPrev: () => setPage(p => Math.max(0, p - 1)),
    goNext: () => setPage(p => Math.min(totalPages - 1, p + 1)),
  }
}
