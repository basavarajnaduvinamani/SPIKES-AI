/**
 * One uploaded CSV stored as JSON rows (column names → string values).
 * Safe to `JSON.stringify` for export or future API payloads.
 */
export type UploadedDataset = {
  id: string
  fileName: string
  columns: string[]
  rows: Record<string, string>[]
  parseWarnings: string[]
  uploadedAt: number
}
