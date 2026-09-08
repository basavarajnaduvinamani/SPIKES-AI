import { detectPatientIdColumn } from '../utils/patientIds'
import type { UploadedDataset } from '../types/dataset'

const HH_MM = /^\d{1,2}:\d{2}$/

/**
 * Metadata upload: one row per patient, not the wide CGM grid.
 * Matches SPIKES_app.py using a separate patient info CSV.
 */
export const findMetadataDataset = (datasets: UploadedDataset[]): UploadedDataset | null => {
  const candidates: UploadedDataset[] = []
  for (const d of datasets) {
    const cols = d.columns.map((c) => c.replace(/^\uFEFF/, '').trim())
    if (!detectPatientIdColumn(d.columns)) continue
    const nTime = cols.filter((c) => HH_MM.test(c)).length
    if (nTime >= 12) continue
    candidates.push(d)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const score = (name: string) =>
      (/metadata|patient_info|patient meta/i.test(name) ? 3 : 0) +
      (/patient/i.test(name) ? 1 : 0) -
      (/cgm|matrix|reported|pillar/i.test(name) ? 2 : 0)
    return score(b.fileName) - score(a.fileName)
  })
  return candidates[0]
}

/** Same resolution order as SPIKES_app.py meta_id_col (Client_ID → fuzzy client+id). */
export const resolveMetaIdColumn = (columns: string[]): string | null => {
  const norm = (s: string) => s.replace(/^\uFEFF/, '').trim()
  const cols = columns.map(norm)
  if (cols.includes('Client_ID')) return 'Client_ID'
  if (cols.includes('Client ID')) return 'Client ID'
  return detectPatientIdColumn(columns)
}

/**
 * SPIKES_app.py uses exact header names; real exports may differ — try aliases in order.
 * Keys are Streamlit display keys; values are possible CSV column names (normalized keys from parse).
 */
const COLUMN_ALIASES: Record<string, readonly string[]> = {
  'Sex Assigned': ['Sex Assigned', 'Sex Assigned at Birth'],
  'Wearable Type': ['Wearable Type', 'Wearble Type'],
  'Waist:Height Ratio': ['Waist:Height Ratio', 'Waist:Height'],
  'Night Owl / Morning Lark': [
    'Night Owl / Morning Lark',
    'Night Owl / Morning Lark / Neither',
  ],
}

const getRaw = (row: Record<string, string>, names: readonly string[]): string | undefined => {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n)) {
      const v = row[n]
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
    }
  }
  return undefined
}

export const metaField = (
  row: Record<string, string>,
  streamlitName: string,
): string | undefined => {
  const aliases = COLUMN_ALIASES[streamlitName] ?? [streamlitName]
  return getRaw(row, aliases)
}

/** SPIKES_app.py `field()` — empty → em dash; optional float format + suffix. */
export const formatMetaField = (
  row: Record<string, string>,
  streamlitName: string,
  opts?: { decimals?: number; suffix?: string },
): string => {
  const raw = metaField(row, streamlitName)
  if (raw === undefined) return '—'
  const s = raw.trim()
  if (s === '') return '—'
  if (opts?.decimals !== undefined) {
    const n = Number.parseFloat(s.replace(/,/g, ''))
    if (!Number.isFinite(n)) return s + (opts.suffix ?? '')
    const d = opts.decimals
    const fmt = d === 0 ? Math.round(n).toFixed(0) : n.toFixed(d)
    return fmt + (opts.suffix ?? '')
  }
  return s + (opts?.suffix ?? '')
}

/** SPIKES_app.py Quick Summary BMI bands (lines 806–816). */
export const bmiCategoryStyle = (
  row: Record<string, string>,
): { label: string; color: string } => {
  const raw = metaField(row, 'BMI') ?? ''
  const n = Number.parseFloat(raw.replace(/,/g, ''))
  if (!Number.isFinite(n)) return { label: '—', color: '#6b7280' }
  if (n < 18.5) return { label: 'Underweight', color: '#3b82f6' }
  if (n < 25) return { label: 'Normal', color: '#22c55e' }
  if (n < 30) return { label: 'Overweight', color: '#f59e0b' }
  return { label: 'Obese', color: '#ef4444' }
}

export const getPatientMetaRow = (
  dataset: UploadedDataset,
  patientId: string,
): Record<string, string> | null => {
  const idCol = resolveMetaIdColumn(dataset.columns)
  if (!idCol) return null
  const want = patientId.trim()
  const row = dataset.rows.find((r) => String(r[idCol] ?? '').trim() === want)
  return row ?? null
}
