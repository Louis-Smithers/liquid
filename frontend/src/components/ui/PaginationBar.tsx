import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationBarProps {
  page: number
  totalPages: number
  totalCount: number
  onPrev: () => void
  onNext: () => void
  /** Optional extra content rendered to the left of the "N TOTAL" label (e.g. ACTIVE/INACTIVE counts). */
  leftExtra?: React.ReactNode
  /** Label for the total count, defaults to "TOTAL". */
  totalLabel?: string
}

/**
 * Reusable pagination footer, extracted from ClientsPage's original inline footer.
 * Renders "{totalCount} {totalLabel} … Page {page+1} of {totalPages}" with prev/next buttons.
 * Purely presentational — callers own the `page` state and slice math (see `usePagination`).
 */
export function PaginationBar({ page, totalPages, totalCount, onPrev, onNext, leftExtra, totalLabel = "TOTAL" }: PaginationBarProps) {
  return (
    <div className="border-t-2 border-[#C7C4D7] bg-[#F7F9FB]">
      <div className="flex flex-row items-center justify-between px-4 py-3.5">
        <div className="flex flex-row items-center gap-3">
          <span className="text-xs font-semibold tracking-[0.6px] text-[#191C1E]">
            {totalCount} {totalLabel}
          </span>
          {leftExtra}
        </div>
        <div className="flex flex-row items-center gap-3">
          <span className="text-xs text-[#464554]">
            Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
          </span>
          <button
            onClick={onPrev}
            disabled={page === 0}
            className="flex items-center justify-center w-7 h-7 rounded border border-[#C7C4D7] bg-white disabled:opacity-40 hover:bg-[#E6E8EA] transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-[#464554]" />
          </button>
          <button
            onClick={onNext}
            disabled={page >= totalPages - 1}
            className="flex items-center justify-center w-7 h-7 rounded border border-[#C7C4D7] bg-white disabled:opacity-40 hover:bg-[#E6E8EA] transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-[#464554]" />
          </button>
        </div>
      </div>
    </div>
  )
}
