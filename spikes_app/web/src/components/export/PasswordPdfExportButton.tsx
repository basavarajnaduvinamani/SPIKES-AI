import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FileDown } from 'lucide-react'
import { buildPdfFilename, exportHtmlToPasswordPdf } from '../../utils/pdfExport'

export type PasswordPdfExportButtonProps = {
  targetRef: RefObject<HTMLElement | null>
  filePrefix: string
  patientId?: string | null
  documentTitle: string
  className?: string
}

export const PasswordPdfExportButton = ({
  targetRef,
  filePrefix,
  patientId,
  documentTitle,
  className = '',
}: PasswordPdfExportButtonProps) => {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleClose = useCallback(() => {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError(null)
  }, [])

  const handleSubmit = useCallback(() => {
    setError(null)
    const el = targetRef.current
    if (!el) {
      setError('Nothing to export yet.')
      return
    }
    if (password.length < 4) {
      setError('Use at least 4 characters for the PDF password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const filename = buildPdfFilename(filePrefix, patientId ?? undefined)
    exportHtmlToPasswordPdf(el, {
      password,
      filename,
      title: documentTitle,
    })
      .then(() => {
        handleClose()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Export failed.')
      })
      .finally(() => {
        setBusy(false)
      })
  }, [confirm, documentTitle, filePrefix, handleClose, password, patientId, targetRef])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-100 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
      >
        <FileDown className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Export PDF
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="presentation"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" />
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[101] w-full max-w-md rounded-xl border border-zinc-200/90 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
              Password-protected PDF
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              The PDF is encrypted (open password). Use a strong password you can share securely with recipients.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor={`${dialogId}-pw`} className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  PDF password
                </label>
                <input
                  ref={firstFieldRef}
                  id={`${dialogId}-pw`}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  aria-invalid={error !== null}
                />
              </div>
              <div>
                <label htmlFor={`${dialogId}-pw2`} className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  Confirm password
                </label>
                <input
                  id={`${dialogId}-pw2`}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !busy) handleSubmit()
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-zinc-600 dark:text-zinc-100"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="rounded-lg bg-wellness-600 px-3 py-2 text-xs font-semibold text-white hover:bg-wellness-700 disabled:opacity-60 dark:bg-wellness-700 dark:hover:bg-wellness-600"
              >
                {busy ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
