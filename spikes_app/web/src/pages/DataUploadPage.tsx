import { useCallback, useId, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { DatasetPreviewTable } from '../components/data/DatasetPreviewTable'
import { useDatasets } from '../context/DatasetProvider'

const ACCEPT = '.csv,text/csv'

export const DataUploadPage = () => {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { datasets, addFiles, removeDataset, clearDatasets, exportAllAsJson, totalRowCount } =
    useDatasets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFileList = useCallback(
    async (list: FileList | File[]) => {
      if (!Array.from(list).length) {
        return
      }

      setError(null)
      setLoading(true)
      try {
        const { loaded, skipped, error: batchError } = await addFiles(list)
        if (skipped.length > 0) {
          setError(
            loaded > 0
              ? `Skipped non-CSV: ${skipped.join(', ')}`
              : `Skipped: ${skipped.join(', ')} — only .csv files are supported.`,
          )
        } else if (batchError && loaded === 0) {
          setError(batchError)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to read files.')
      } finally {
        setLoading(false)
      }
    },
    [addFiles],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (list?.length) {
      void loadFileList(list)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files?.length) {
      void loadFileList(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleExportAll = () => {
    const json = exportAllAsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spikes-datasets-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <section className="glass-card p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-base font-semibold text-slate-900 sm:text-lg dark:text-zinc-50">
              Data upload
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400/85">
              CSV files are parsed to <strong className="font-medium text-wellness-800 dark:text-wellness-300">JSON rows</strong> and kept in app memory for all screens. Tables below use{' '}
              <strong className="font-medium text-wellness-800 dark:text-wellness-300">pagination</strong> so large files stay responsive.
            </p>
            {datasets.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400/90">
                {datasets.length} file{datasets.length === 1 ? '' : 's'} · {totalRowCount.toLocaleString()} total rows in memory
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            {datasets.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
                >
                  <Download className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Export all JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearDatasets()
                    setError(null)
                  }}
                  className="rounded-lg border border-zinc-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        <div
          className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300/80 bg-zinc-50/80 px-4 py-8 text-center transition hover:border-zinc-400 hover:bg-zinc-100/90 dark:border-zinc-600 dark:bg-zinc-900/40 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/40"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload CSV files by click or drop"
        >
          <Upload className="mx-auto size-8 text-wellness-600 dark:text-wellness-500" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-wellness-100">
            Drop CSV files here or{' '}
            <label htmlFor={inputId} className="cursor-pointer text-wellness-700 underline dark:text-wellness-400">
              browse
            </label>
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-wellness-500/80">Multiple files · converts to JSON · paginated preview</p>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Choose CSV files"
          />
        </div>

        {loading && (
          <p className="mt-3 text-xs text-wellness-700 dark:text-wellness-300" role="status">
            Parsing CSV to JSON…
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300/90" role="alert">
            {error}
          </p>
        )}
      </section>

      {datasets.map((d) => (
        <DatasetPreviewTable key={d.id} dataset={d} onRemove={() => removeDataset(d.id)} />
      ))}

      {datasets.length === 0 && !loading && (
        <p className="text-center text-xs text-slate-500 dark:text-wellness-500/75">
          No datasets in memory. Upload CSV files above — data will be available app-wide via the dataset store.
        </p>
      )}
    </div>
  )
}
