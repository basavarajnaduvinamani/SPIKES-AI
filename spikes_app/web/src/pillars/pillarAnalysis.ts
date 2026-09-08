/**
 * Port of pillar_analysis.py — clean_pillars, patient_summary, constants.
 * Supports both "Gauge Trend" (docstring) and "Gauge Change" (data/patient_reported_metrics.csv).
 */

import { detectPatientIdColumn } from '../utils/patientIds'
import type { UploadedDataset } from '../types/dataset'

export const PILLAR_NAMES = ['Health', 'Sleep', 'Nutrition', 'Movement', 'Stress', 'Connection'] as const
export type PillarName = (typeof PILLAR_NAMES)[number]

export const NEGATIVE_COL = 'Negative Gauge'

export const GAUGE_COLS: Record<PillarName, string> = {
  Health: 'Health Gauge',
  Sleep: 'Sleep Gauge',
  Nutrition: 'Nutrition Gauge',
  Movement: 'Movement Gauge',
  Stress: 'Stress Gauge',
  Connection: 'Connection Gauge',
}

/** SPIKES exports use "Gauge Change" instead of "Gauge Trend". */
export const trendColumnCandidates = (pillar: PillarName): string[] => [
  `${pillar} Gauge Trend`,
  `${pillar} Gauge Change`,
]

export const PILLAR_COLORS: Record<PillarName, string> = {
  Health: '#4a90d9',
  Sleep: '#7c5cbf',
  Nutrition: '#22c55e',
  Movement: '#f59e0b',
  Stress: '#ef4444',
  Connection: '#ec4899',
}

export const TREND_COLORS: Record<'improving' | 'staying the same' | 'declining', string> = {
  improving: '#22c55e',
  'staying the same': '#6b7280',
  declining: '#ef4444',
}

const TREND_FIXES: Record<string, string> = {
  'staying the': 'staying the same',
  'staying the s': 'staying the same',
  'staying the sa': 'staying the same',
  'staying the sam': 'staying the same',
  'staying the same': 'staying the same',
}

const norm = (s: string) => s.replace(/^\uFEFF/, '').trim()

export type PillarSummaryInfo = {
  mean: number | null
  median: number | null
  std: number | null
  min: number | null
  max: number | null
  first: number | null
  last: number | null
  delta: number | null
  trend_counts: Record<string, number>
  dominant_trend: string | null
}

export type PatientPillarSummary = {
  patient_id: string
  n_days: number
  pillars: Record<PillarName, PillarSummaryInfo>
  negative: {
    mean: number
    median: number
    std: number
    min: number
    max: number
  } | null
}

const parseNum = (v: string | undefined): number | null => {
  if (v === undefined || v === '') return null
  const n = Number.parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Resolve which trend column exists in the dataset for a pillar. */
export const resolveTrendColumn = (columns: string[], pillar: PillarName): string | null => {
  const set = new Set(columns.map(norm))
  for (const c of trendColumnCandidates(pillar)) {
    if (set.has(norm(c))) return c
  }
  return null
}

export type CleanPillarsResult = {
  idCol: string
  rows: Record<string, string>[]
  trendColByPillar: Record<PillarName, string | null>
}

/**
 * Mirrors clean_pillars(): strip headers, coerce gauges, normalise trends, day_index per patient.
 */
export const cleanPillarsFromDataset = (dataset: UploadedDataset): CleanPillarsResult | null => {
  const idCol = detectPatientIdColumn(dataset.columns)
  if (!idCol) return null

  const trendColByPillar = {} as Record<PillarName, string | null>
  for (const p of PILLAR_NAMES) {
    trendColByPillar[p] = resolveTrendColumn(dataset.columns, p)
  }

  const rows: Record<string, string>[] = []
  for (const raw of dataset.rows) {
    const id = String(raw[idCol] ?? '').trim()
    if (!id) continue

    const row: Record<string, string> = { ...raw, [idCol]: id }

    for (const p of PILLAR_NAMES) {
      const gcol = GAUGE_COLS[p]
      if (gcol in row) {
        const n = parseNum(row[gcol])
        row[gcol] = n === null ? '' : String(n)
      }
      const tcol = trendColByPillar[p]
      if (tcol && tcol in row) {
        let t = String(row[tcol] ?? '').trim().toLowerCase()
        t = TREND_FIXES[t] ?? t
        row[tcol] = t
      }
    }

    if (NEGATIVE_COL in row) {
      const n = parseNum(row[NEGATIVE_COL])
      row[NEGATIVE_COL] = n === null ? '' : String(n)
    }

    rows.push(row)
  }

  const byPatient = new Map<string, number>()
  for (const row of rows) {
    const id = String(row[idCol])
    const next = (byPatient.get(id) ?? 0) + 1
    byPatient.set(id, next)
    row.day_index = String(next)
  }

  return { idCol, rows, trendColByPillar }
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** Mirrors patient_summary() — first/last non-null gauge values in dataframe row order (matches pandas). */
export const patientSummary = (
  clean: CleanPillarsResult,
  patientId: string,
): PatientPillarSummary => {
  const want = String(patientId).trim()
  const subset = clean.rows.filter((r) => String(r[clean.idCol]).trim() === want)

  if (subset.length === 0) {
    return {
      patient_id: patientId,
      n_days: 0,
      pillars: {} as Record<PillarName, PillarSummaryInfo>,
      negative: null,
    }
  }

  const nDays = subset.length
  const pillars = {} as Record<PillarName, PillarSummaryInfo>

  for (const pillar of PILLAR_NAMES) {
    const gcol = GAUGE_COLS[pillar]
    const tcol = clean.trendColByPillar[pillar]

    const vals: number[] = []
    for (const row of subset) {
      const n = parseNum(row[gcol])
      if (n !== null) vals.push(n)
    }

    const trends: string[] = []
    if (tcol) {
      for (const row of subset) {
        const t = String(row[tcol] ?? '').trim().toLowerCase()
        if (t && t !== 'nan') trends.push(t)
      }
    }

    let pinfo: PillarSummaryInfo
    if (vals.length > 0) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const sorted = [...vals].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median =
        sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      const variance =
        vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(vals.length, 1)
      const std = Math.sqrt(variance)
      pinfo = {
        mean: round2(mean),
        median: round2(median),
        std: round2(std),
        min: Math.round(Math.min(...vals)),
        max: Math.round(Math.max(...vals)),
        first: vals[0],
        last: vals[vals.length - 1],
        delta: round2(vals[vals.length - 1] - vals[0]),
        trend_counts: {},
        dominant_trend: null,
      }
    } else {
      pinfo = {
        mean: null,
        median: null,
        std: null,
        min: null,
        max: null,
        first: null,
        last: null,
        delta: null,
        trend_counts: {},
        dominant_trend: null,
      }
    }

    const validTrends = trends.filter((t) =>
      ['improving', 'staying the same', 'declining'].includes(t),
    )
    if (validTrends.length > 0) {
      const tc: Record<string, number> = {}
      for (const t of validTrends) {
        tc[t] = (tc[t] ?? 0) + 1
      }
      pinfo.trend_counts = tc
      pinfo.dominant_trend = Object.keys(tc).reduce((a, b) => (tc[a] >= tc[b] ? a : b))
    }

    pillars[pillar] = pinfo
  }

  let negative: PatientPillarSummary['negative'] = null
  const negVals: number[] = []
  for (const row of subset) {
    const n = parseNum(row[NEGATIVE_COL])
    if (n !== null) negVals.push(n)
  }
  if (negVals.length > 0) {
    const mean = negVals.reduce((a, b) => a + b, 0) / negVals.length
    const sorted = [...negVals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median =
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const variance =
      negVals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(negVals.length, 1)
    negative = {
      mean: round2(mean),
      median: round2(median),
      std: round2(Math.sqrt(variance)),
      min: Math.round(Math.min(...negVals)),
      max: Math.round(Math.max(...negVals)),
    }
  }

  return {
    patient_id: patientId,
    n_days: nDays,
    pillars,
    negative,
  }
}

/** Mean gauge per pillar — matches plot_pillar_radar. */
export const pillarMeansForRadar = (
  clean: CleanPillarsResult,
  patientId: string,
): { pillar: PillarName; value: number }[] => {
  const want = String(patientId).trim()
  const subset = clean.rows.filter((r) => String(r[clean.idCol]).trim() === want)
  return PILLAR_NAMES.map((pillar) => {
    const gcol = GAUGE_COLS[pillar]
    const vals: number[] = []
    for (const row of subset) {
      const n = parseNum(row[gcol])
      if (n !== null) vals.push(n)
    }
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { pillar, value: Number.isFinite(mean) ? mean : 0 }
  })
}

/** Data for stacked horizontal trend chart — matches plot_trend_distribution. */
export const trendDistributionData = (
  clean: CleanPillarsResult,
  patientId: string,
): {
  pillar: PillarName
  improving: number
  staying: number
  declining: number
}[] => {
  const want = String(patientId).trim()
  const subset = clean.rows.filter((r) => String(r[clean.idCol]).trim() === want)
  const order = [...PILLAR_NAMES].reverse()
  const out: {
    pillar: PillarName
    improving: number
    staying: number
    declining: number
  }[] = []

  for (const pillar of order) {
    const tcol = clean.trendColByPillar[pillar]
    if (!tcol) continue
    const valid: string[] = []
    for (const row of subset) {
      const t = String(row[tcol] ?? '').trim().toLowerCase()
      if (['improving', 'staying the same', 'declining'].includes(t)) valid.push(t)
    }
    if (valid.length === 0) continue
    const counts = { improving: 0, 'staying the same': 0, declining: 0 }
    for (const t of valid) {
      counts[t as keyof typeof counts] += 1
    }
    const total = valid.length
    out.push({
      pillar,
      improving: (counts.improving / total) * 100,
      staying: (counts['staying the same'] / total) * 100,
      declining: (counts.declining / total) * 100,
    })
  }
  return out
}

export const gaugesTimeseriesData = (
  clean: CleanPillarsResult,
  patientId: string,
): { day: number; [key: string]: number | string }[] => {
  const want = String(patientId).trim()
  const subset = clean.rows.filter((r) => String(r[clean.idCol]).trim() === want)
  return subset.map((row) => {
    const day = Number.parseInt(String(row.day_index ?? '0'), 10) || 0
    const pt: { day: number; [key: string]: number | string } = { day }
    for (const p of PILLAR_NAMES) {
      const n = parseNum(row[GAUGE_COLS[p]])
      pt[p] = n === null ? Number.NaN : n
    }
    return pt
  })
}

export const negativeGaugeTimeseries = (
  clean: CleanPillarsResult,
  patientId: string,
): { day: number; neg: number }[] => {
  const want = String(patientId).trim()
  const subset = clean.rows.filter((r) => String(r[clean.idCol]).trim() === want)
  const out: { day: number; neg: number }[] = []
  for (const row of subset) {
    const day = Number.parseInt(String(row.day_index ?? '0'), 10) || 0
    const n = parseNum(row[NEGATIVE_COL])
    if (n !== null) out.push({ day, neg: n })
  }
  out.sort((a, b) => a.day - b.day)
  return out
}

const HH_MM = /^\d{1,2}:\d{2}$/

export const findPillarsDataset = (datasets: UploadedDataset[]): UploadedDataset | null => {
  const candidates: UploadedDataset[] = []
  for (const d of datasets) {
    const cols = d.columns.map((c) => norm(c))
    if (!detectPatientIdColumn(d.columns)) continue
    const nTime = cols.filter((c) => HH_MM.test(c)).length
    if (nTime >= 12) continue
    const hasGauge =
      cols.includes('Health Gauge') ||
      cols.some((c) => /gauge/i.test(c) && /health|sleep|nutrition|movement|stress|connection/i.test(c))
    if (hasGauge) candidates.push(d)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const score = (name: string) =>
      (/pillar|reported|lifestyle|gauge/i.test(name) ? 2 : 0) -
      (/metadata|patient_meta(?!.*reported)/i.test(name) ? 1 : 0)
    return score(b.fileName) - score(a.fileName)
  })
  return candidates[0]
}
