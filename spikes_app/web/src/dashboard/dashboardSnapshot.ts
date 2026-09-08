import type { AnnotatedRow, SpikeEvent } from '../analysis/spikeDetection'
import { runCgmDetectSync } from '../analysis/cgmWorkerClient'
import {
  computeSummaryMetrics,
  defaultActiveLayers,
  eventMatchesLayers,
  findCgmWideDataset,
  type CgmSummaryMetrics,
} from '../cgm/cgmHelpers'
import {
  bmiCategoryStyle,
  findMetadataDataset,
  getPatientMetaRow,
  metaField,
} from '../overview/patientMetaResolve'
import {
  cleanPillarsFromDataset,
  findPillarsDataset,
  PILLAR_NAMES,
  patientSummary,
  type PatientPillarSummary,
} from '../pillars/pillarAnalysis'
import { detectPatientIdColumn } from '../utils/patientIds'
import type { UploadedDataset } from '../types/dataset'

const TIME_LIKE = /^\d{1,2}:\d{2}$/

const normCol = (c: string) => c.replace(/^\uFEFF/, '').trim()

const countTimeCols = (d: UploadedDataset) =>
  d.columns.map(normCol).filter((c) => TIME_LIKE.test(c)).length

export const isCgmWideShape = (d: UploadedDataset): boolean => {
  const cols = d.columns.map(normCol)
  return cols.includes('Client ID') && cols.includes('Day') && countTimeCols(d) >= 24
}

export const isPillarsShape = (d: UploadedDataset): boolean => {
  const cols = d.columns.map(normCol)
  if (countTimeCols(d) >= 12) return false
  if (!detectPatientIdColumn(d.columns)) return false
  const hasGauge =
    cols.includes('Health Gauge') ||
    cols.some((c) => /gauge/i.test(c) && /health|sleep|nutrition|movement|stress|connection/i.test(c))
  return hasGauge
}

export type DatasetKind = 'cgm_wide' | 'pillars' | 'tabular' | 'unknown'

export const classifyUploadedDataset = (d: UploadedDataset): DatasetKind => {
  if (isCgmWideShape(d)) return 'cgm_wide'
  if (isPillarsShape(d)) return 'pillars'
  if (detectPatientIdColumn(d.columns)) return 'tabular'
  return 'unknown'
}

export type DatasetInventory = {
  totalFiles: number
  totalRows: number
  cgmWide: number
  pillars: number
  tabular: number
  unknown: number
  lastUploadedAt: number | null
}

export const buildDatasetInventory = (
  datasets: UploadedDataset[],
  totalRows: number,
): DatasetInventory => {
  let cgmWide = 0
  let pillars = 0
  let tabular = 0
  let unknown = 0
  let lastUploadedAt: number | null = null
  for (const d of datasets) {
    const k = classifyUploadedDataset(d)
    if (k === 'cgm_wide') cgmWide += 1
    else if (k === 'pillars') pillars += 1
    else if (k === 'tabular') tabular += 1
    else unknown += 1
    if (lastUploadedAt === null || d.uploadedAt > lastUploadedAt) lastUploadedAt = d.uploadedAt
  }
  return {
    totalFiles: datasets.length,
    totalRows,
    cgmWide,
    pillars,
    tabular,
    unknown,
    lastUploadedAt,
  }
}

const averagePillarMeans = (summary: PatientPillarSummary): number | null => {
  const vals: number[] = []
  for (const p of PILLAR_NAMES) {
    const m = summary.pillars[p]?.mean
    if (m !== null && m !== undefined && Number.isFinite(m)) vals.push(m)
  }
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export type DashboardPatientSnapshot = {
  patientId: string
  cgm: {
    available: boolean
    hasReadings: boolean
    metrics: CgmSummaryMetrics | null
    uniqueDays: number
  }
  pillars: {
    available: boolean
    summary: PatientPillarSummary | null
    averageGauge: number | null
  }
  profile: {
    available: boolean
    age: string | null
    sex: string | null
    bmi: string | null
    bmiCategory: { label: string; color: string } | null
    healthGoal: string | null
  }
}

export const emptyCgmDashboardSection = (): DashboardPatientSnapshot['cgm'] => ({
  available: false,
  hasReadings: false,
  metrics: null,
  uniqueDays: 0,
})

/** Build CGM summary card data from detection output (same logic as dashboard CGM block). */
export const buildCgmDashboardSection = (
  events: SpikeEvent[],
  annotated: AnnotatedRow[],
): DashboardPatientSnapshot['cgm'] => {
  const hasReadings = annotated.length > 0
  const filtered = events.filter((e) => eventMatchesLayers(e, defaultActiveLayers))
  const dates = new Set(annotated.map((a) => a.date))
  const uniqueDays = dates.size
  const metrics = computeSummaryMetrics(filtered, uniqueDays)
  return {
    available: true,
    hasReadings,
    metrics,
    uniqueDays,
  }
}

export type PillarsAndProfile = {
  pillars: DashboardPatientSnapshot['pillars']
  profile: DashboardPatientSnapshot['profile']
}

/** Pillars + profile only (fast, main-thread). */
export const computePillarsAndProfile = (datasets: UploadedDataset[], patientId: string): PillarsAndProfile => {
  const pid = patientId.trim()

  const pillarsFile = findPillarsDataset(datasets)
  const clean = pillarsFile ? cleanPillarsFromDataset(pillarsFile) : null
  let pillarsPart: DashboardPatientSnapshot['pillars'] = {
    available: false,
    summary: null,
    averageGauge: null,
  }
  if (clean) {
    const summary = patientSummary(clean, pid)
    const hasDays = summary.n_days > 0
    pillarsPart = {
      available: hasDays,
      summary: hasDays ? summary : null,
      averageGauge: hasDays ? averagePillarMeans(summary) : null,
    }
  }

  const metaDs = findMetadataDataset(datasets)
  const row = metaDs ? getPatientMetaRow(metaDs, pid) : null
  let profilePart: DashboardPatientSnapshot['profile'] = {
    available: false,
    age: null,
    sex: null,
    bmi: null,
    bmiCategory: null,
    healthGoal: null,
  }
  if (row) {
    const age = metaField(row, 'Age')
    const sex = metaField(row, 'Sex Assigned')
    const bmiRaw = metaField(row, 'BMI')
    const bmi = bmiRaw !== undefined && String(bmiRaw).trim() !== '' ? String(bmiRaw).trim() : null
    const hg = metaField(row, 'Health Goal')
    let healthGoal: string | null = null
    if (hg !== undefined) {
      const t = hg.trim()
      if (t !== '') {
        healthGoal = t.length > 120 ? `${t.slice(0, 117)}…` : t
      }
    }
    profilePart = {
      available: true,
      age: age !== undefined && String(age).trim() !== '' ? String(age).trim() : null,
      sex: sex !== undefined && String(sex).trim() !== '' ? String(sex).trim() : null,
      bmi,
      bmiCategory: bmi ? bmiCategoryStyle(row) : null,
      healthGoal,
    }
  }

  return { pillars: pillarsPart, profile: profilePart }
}

export const mergeDashboardSnapshot = (
  patientId: string,
  pillars: DashboardPatientSnapshot['pillars'],
  profile: DashboardPatientSnapshot['profile'],
  cgm: DashboardPatientSnapshot['cgm'],
): DashboardPatientSnapshot => ({
  patientId,
  pillars,
  profile,
  cgm,
})

/** Full snapshot on main thread (sync CGM path) — for tests or fallbacks. */
export const computeDashboardPatientSnapshot = (
  datasets: UploadedDataset[],
  patientId: string | null,
): DashboardPatientSnapshot | null => {
  if (!patientId) return null
  const pid = patientId.trim()
  const { pillars, profile } = computePillarsAndProfile(datasets, pid)

  const cgmDataset = findCgmWideDataset(datasets)
  let cgmPart: DashboardPatientSnapshot['cgm'] = emptyCgmDashboardSection()
  if (cgmDataset) {
    const { events, annotated } = runCgmDetectSync(cgmDataset.rows, cgmDataset.columns, pid)
    cgmPart = buildCgmDashboardSection(events, annotated)
  }

  return {
    patientId: pid,
    cgm: cgmPart,
    pillars,
    profile,
  }
}
