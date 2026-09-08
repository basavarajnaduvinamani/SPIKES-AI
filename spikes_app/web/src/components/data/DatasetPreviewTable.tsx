import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Trash2 } from 'lucide-react'
import type { UploadedDataset } from '../../types/dataset'
import { PaginationControls } from './PaginationControls'

type DatasetPreviewTableProps = {
  dataset: UploadedDataset
  onRemove: () => void
}

export const DatasetPreviewTable = ({ dataset, onRemove }: DatasetPreviewTableProps) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const totalRows = dataset.rows.length

  useEffect(() => {
    setPage(1)
  }, [pageSize, dataset.id])

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize) || 1)

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  const pageRows = dataset.rows.slice(offset, offset + pageSize)

  const handleDownloadJson = () => {
    const payload = {
      fileName: dataset.fileName,
      uploadedAt: dataset.uploadedAt,
      columns: dataset.columns,
      rows: dataset.rows,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dataset.fileName.replace(/\.csv$/i, '') || 'dataset'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="glass-card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 px-3 py-2 dark:border-zinc-700/50 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-wellness-600 dark:text-wellness-500" aria-hidden="true" />
                <h2 className="truncate font-display text-sm font-semibold text-slate-900 dark:text-zinc-50">
            {dataset.fileName}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500 dark:text-zinc-500/80">
            {totalRows} rows · {dataset.columns.length} columns · JSON
          </span>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/70 px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
          >
            <Download className="size-3" strokeWidth={2} aria-hidden="true" />
            JSON
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-white/70 text-slate-600 transition hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800/70 dark:hover:bg-red-950/50 dark:hover:text-red-300"
            aria-label={`Remove ${dataset.fileName}`}
          >
            <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      {dataset.parseWarnings.length > 0 && (
        <div className="border-b border-amber-200/60 bg-amber-50/50 px-3 py-1.5 text-[10px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200/90">
          Parser notes: {dataset.parseWarnings.join(' · ')}
        </div>
      )}
      <div className="max-h-[min(60vh,480px)] overflow-auto">
        <table className="min-w-full border-collapse text-left text-[11px] sm:text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 dark:bg-zinc-900/95">
            <tr>
              <th className="sticky left-0 z-20 border-b border-r border-zinc-200/80 bg-zinc-100/95 px-1.5 py-1.5 text-left font-semibold text-slate-600 dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-400">
                #
              </th>
              {dataset.columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-zinc-200/80 px-2 py-1.5 font-semibold text-slate-800 dark:border-zinc-700/60 dark:text-zinc-100"
                >
                  <span className="block max-w-[14rem] truncate" title={col}>
                    {col}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const globalIndex = offset + i + 1
              return (
                <tr
                  key={`${dataset.id}-row-${offset + i}`}
                  className="odd:bg-white/40 even:bg-zinc-50/50 dark:odd:bg-zinc-900/25 dark:even:bg-zinc-800/20"
                >
                  <td className="sticky left-0 z-[1] border-b border-r border-zinc-200/70 bg-inherit px-1.5 py-1 font-mono text-[10px] text-slate-500 dark:border-zinc-700/60 dark:text-zinc-500">
                    {globalIndex}
                  </td>
                  {dataset.columns.map((col) => (
                    <td
                      key={col}
                      className="max-w-[14rem] whitespace-pre-wrap border-b border-zinc-200/60 px-2 py-1 text-slate-800 dark:border-zinc-700/50 dark:text-zinc-100"
                    >
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={safePage}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </section>
  )
}
