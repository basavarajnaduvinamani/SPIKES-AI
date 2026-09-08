import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UploadedDataset } from '../types/dataset'
import { parseCsvFileToJson } from '../utils/csvParse'
import { unionPatientIdsAcrossDatasets } from '../utils/patientIds'

type DatasetContextValue = {
  datasets: UploadedDataset[]
  /**
   * Unique participant ids (`Client ID` / `Client_ID`) across all uploads — same notion as
   * SPIKES_app.py `patients` from CGM and meta/pillars tabs.
   */
  patientIds: string[]
  selectedPatientId: string | null
  setSelectedPatientId: (id: string | null) => void
  totalRowCount: number
  addFiles: (files: FileList | File[]) => Promise<{ loaded: number; skipped: string[]; error?: string }>
  removeDataset: (id: string) => void
  clearDatasets: () => void
  /** Export all datasets as one JSON-serializable payload (e.g. for download or debugging). */
  exportAllAsJson: () => string
}

const DatasetContext = createContext<DatasetContextValue | null>(null)

const makeId = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 10)}`

export const DatasetProvider = ({ children }: { children: ReactNode }) => {
  const [datasets, setDatasets] = useState<UploadedDataset[]>([])
  const [selectedPatientIdState, setSelectedPatientIdState] = useState<string | null>(null)

  const patientIds = useMemo(() => unionPatientIdsAcrossDatasets(datasets), [datasets])

  useEffect(() => {
    if (patientIds.length === 0) {
      setSelectedPatientIdState(null)
      return
    }
    const stillValid =
      selectedPatientIdState && patientIds.includes(selectedPatientIdState)
    if (!stillValid) {
      setSelectedPatientIdState(patientIds[0])
    }
  }, [patientIds, selectedPatientIdState])

  const activePatientId = useMemo(() => {
    if (patientIds.length === 0) return null
    if (selectedPatientIdState && patientIds.includes(selectedPatientIdState)) {
      return selectedPatientIdState
    }
    return patientIds[0]
  }, [patientIds, selectedPatientIdState])

  const totalRowCount = useMemo(
    () => datasets.reduce((acc, d) => acc + d.rows.length, 0),
    [datasets],
  )

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list)
    const skipped: string[] = []
    const next: UploadedDataset[] = []

    for (const file of arr) {
      const isCsv =
        /\.csv$/i.test(file.name) ||
        file.type === 'text/csv' ||
        file.type === 'application/vnd.ms-excel'

      if (!isCsv) {
        skipped.push(file.name)
        continue
      }

      try {
        const { columns, rows, parseErrors } = await parseCsvFileToJson(file)
        next.push({
          id: makeId(file),
          fileName: file.name,
          columns,
          rows,
          parseWarnings: parseErrors,
          uploadedAt: Date.now(),
        })
      } catch {
        skipped.push(file.name)
      }
    }

    if (next.length > 0) {
      setDatasets((prev) => [...prev, ...next])
    }

    let error: string | undefined
    if (skipped.length > 0 && next.length === 0 && arr.length > 0) {
      error = 'No CSV files could be loaded.'
    }

    return { loaded: next.length, skipped, error }
  }, [])

  const removeDataset = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const clearDatasets = useCallback(() => {
    setDatasets([])
  }, [])

  const exportAllAsJson = useCallback(() => {
    const payload = datasets.map((d) => ({
      fileName: d.fileName,
      uploadedAt: d.uploadedAt,
      columns: d.columns,
      rows: d.rows,
    }))
    return JSON.stringify(payload, null, 2)
  }, [datasets])

  const value = useMemo(
    () => ({
      datasets,
      patientIds,
      selectedPatientId: activePatientId,
      setSelectedPatientId: setSelectedPatientIdState,
      totalRowCount,
      addFiles,
      removeDataset,
      clearDatasets,
      exportAllAsJson,
    }),
    [
      datasets,
      patientIds,
      activePatientId,
      totalRowCount,
      addFiles,
      removeDataset,
      clearDatasets,
      exportAllAsJson,
    ],
  )

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
}

export const useDatasets = (): DatasetContextValue => {
  const ctx = useContext(DatasetContext)
  if (!ctx) {
    throw new Error('useDatasets must be used within DatasetProvider')
  }
  return ctx
}
