const PAGE_SIZES = [25, 50, 100, 200] as const

type PaginationControlsProps = {
  page: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const PaginationControls = ({
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) => {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize) || 1)
  const safePage = Math.min(page, totalPages)
  const start = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalRows)

  const handlePrev = () => {
    onPageChange(Math.max(1, safePage - 1))
  }

  const handleNext = () => {
    onPageChange(Math.min(totalPages, safePage + 1))
  }

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-200/70 px-3 py-2 text-[11px] dark:border-zinc-700/50 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-slate-600 dark:text-zinc-400/85">
        {totalRows === 0 ? (
          'No rows'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-slate-800 dark:text-zinc-200">{start}</span>–
            <span className="font-medium text-slate-800 dark:text-zinc-200">{end}</span> of{' '}
            <span className="font-medium text-slate-800 dark:text-zinc-200">{totalRows}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400/90">
          <span className="sr-only">Rows per page</span>
          <span className="hidden sm:inline">Rows / page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-zinc-200/80 bg-white px-1.5 py-0.5 text-[11px] text-slate-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePage <= 1 || totalRows === 0}
            className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-0.5 font-medium text-slate-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:enabled:hover:bg-zinc-700"
          >
            Prev
          </button>
          <span className="px-1 text-slate-500 dark:text-zinc-500/90">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={safePage >= totalPages || totalRows === 0}
            className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-0.5 font-medium text-slate-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:enabled:hover:bg-zinc-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
