import Papa from 'papaparse'

/** Strip BOM / trim so "Client ID" matches even with \ufeff in first header cell. */
export const normalizeCsvHeader = (h: string) => h.replace(/^\uFEFF/, '').trim()

export type CsvGrid = {
  rows: string[][]
  parseErrors: string[]
}

export type CsvJsonResult = {
  columns: string[]
  rows: Record<string, string>[]
  parseErrors: string[]
}

/**
 * Parse CSV into a 2D grid (legacy / inspection).
 */
export const parseCsvFileToGrid = (file: File): Promise<CsvGrid> => {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      complete: (results) => {
        const rows = (results.data as string[][]).map((row) =>
          row.map((cell) => (cell == null ? '' : String(cell))),
        )
        const parseErrors =
          results.errors?.map((e) => `${e.type}${e.row != null ? ` (row ${e.row})` : ''}: ${e.message}`) ??
          []
        resolve({ rows, parseErrors })
      },
      error: (err) => reject(err),
      skipEmptyLines: false,
    })
  })
}

/**
 * Parse CSV with a header row → array of JSON objects (all values as strings).
 * This is the canonical shape for app-wide state and pagination.
 */
export const parseCsvFileToJson = (file: File): Promise<CsvJsonResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: (results) => {
        const rawFields = (results.meta.fields ?? []).filter((f): f is string => Boolean(f))
        const fields = rawFields.map((f) => normalizeCsvHeader(f))
        const raw = results.data as Record<string, unknown>[]
        const rows: Record<string, string>[] = raw.map((row) => {
          const out: Record<string, string> = {}
          rawFields.forEach((oldKey, i) => {
            const v = row[oldKey]
            out[fields[i]] = v == null ? '' : String(v)
          })
          return out
        })
        const parseErrors =
          results.errors?.map((e) => `${e.type}${e.row != null ? ` (row ${e.row})` : ''}: ${e.message}`) ??
          []
        resolve({ columns: fields, rows, parseErrors })
      },
      error: (err) => reject(err),
    })
  })
}
