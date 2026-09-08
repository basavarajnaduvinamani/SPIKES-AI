import type { UploadedDataset } from '../types/dataset'

/**
 * SPIKES CSVs use a shared participant key:
 * - CGM / pillars: `Client ID` (SPIKES_app.py id_col)
 * - Metadata: `Client_ID` or columns matching client + id (SPIKES_app.py meta_id_col)
 */
const normalizeHeader = (c: string) =>
  c.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Match Streamlit logic: exact names first, then fuzzy client+id. */
export const detectPatientIdColumn = (columns: string[]): string | null => {
  if (columns.length === 0) return null

  const exactPreferred = ['client id', 'client_id']
  for (const want of exactPreferred) {
    const found = columns.find((c) => normalizeHeader(c) === want)
    if (found) return found
  }

  for (const col of columns) {
    const n = normalizeHeader(col)
    if (n.includes('client') && n.includes('id')) return col
  }

  return null
}

export const extractUniquePatientIds = (dataset: UploadedDataset): string[] => {
  const col = detectPatientIdColumn(dataset.columns)
  if (!col) return []

  const seen = new Set<string>()
  for (const row of dataset.rows) {
    const raw = row[col]
    if (raw == null) continue
    const s = String(raw).trim()
    if (s !== '') seen.add(s)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

export const unionPatientIdsAcrossDatasets = (datasets: UploadedDataset[]): string[] => {
  const union = new Set<string>()
  for (const d of datasets) {
    for (const id of extractUniquePatientIds(d)) {
      union.add(id)
    }
  }
  return [...union].sort((a, b) => a.localeCompare(b))
}

export const filterRowsByPatient = (
  dataset: UploadedDataset,
  patientId: string,
): Record<string, string>[] => {
  const col = detectPatientIdColumn(dataset.columns)
  if (!col) return []
  const want = patientId.trim()
  return dataset.rows.filter((row) => String(row[col] ?? '').trim() === want)
}
