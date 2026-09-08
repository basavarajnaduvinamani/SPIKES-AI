import type { UploadedDataset } from '../types/dataset'
import type { SpikeEvent } from '../analysis/spikeDetection'

const TIME_LIKE = /^\d{1,2}:\d{2}$/

const countTimeCols = (d: UploadedDataset) =>
  d.columns.map((c) => c.replace(/^\uFEFF/, '').trim()).filter((c) => TIME_LIKE.test(c)).length

/** Prefer the real CGM grid (many HH:MM columns); filename hints cgm_matrix. */
export const findCgmWideDataset = (datasets: UploadedDataset[]): UploadedDataset | null => {
  const candidates: UploadedDataset[] = []
  for (const d of datasets) {
    const cols = d.columns.map((c) => c.replace(/^\uFEFF/, '').trim())
    if (!cols.includes('Client ID') || !cols.includes('Day')) continue
    if (countTimeCols(d) >= 24) candidates.push(d)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const ca = countTimeCols(a)
    const cb = countTimeCols(b)
    if (cb !== ca) return cb - ca
    const score = (name: string) => (/cgm/i.test(name) ? 2 : 0) + (/matrix/i.test(name) ? 1 : 0)
    return score(b.fileName) - score(a.fileName)
  })
  return candidates[0]
}

export type ActiveLayerKey =
  | 'spike_hc'
  | 'spike_sens'
  | 'dip_hc'
  | 'dip_sens'

export const defaultActiveLayers: Record<ActiveLayerKey, boolean> = {
  spike_hc: true,
  spike_sens: true,
  dip_hc: true,
  dip_sens: true,
}

export const eventMatchesLayers = (
  e: SpikeEvent,
  layers: Record<ActiveLayerKey, boolean>,
): boolean => {
  const key: ActiveLayerKey =
    e.direction === 'up'
      ? e.tier === 'high_confidence'
        ? 'spike_hc'
        : 'spike_sens'
      : e.tier === 'high_confidence'
        ? 'dip_hc'
        : 'dip_sens'
  return layers[key] === true
}

export const classifyTimeOfDay = (hour: number): 'Morning' | 'Afternoon' | 'Evening' | 'Night' => {
  if (hour >= 6 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 18) return 'Afternoon'
  if (hour >= 18 && hour < 24) return 'Evening'
  return 'Night'
}

export const PERIOD_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'] as const

export const PERIOD_COLOURS: Record<(typeof PERIOD_ORDER)[number], string> = {
  Morning: '#F59E0B',
  Afternoon: '#EF4444',
  Evening: '#6366F1',
  Night: '#1E3A5F',
}

export type CgmSummaryMetrics = {
  nSpikes: number
  nDips: number
  nDays: number
  meanConf: number
  maxGlucoseSpike: number
  minGlucoseDip: number
}

export const computeSummaryMetrics = (
  filtered: SpikeEvent[],
  uniqueCalendarDays: number,
): CgmSummaryMetrics => {
  const spikes = filtered.filter((e) => e.direction === 'up')
  const dips = filtered.filter((e) => e.direction === 'down')
  const nTotal = filtered.length
  let meanConf = 0
  if (nTotal > 0) {
    meanConf = filtered.reduce((s, e) => s + e.p_val, 0) / nTotal
  }
  let maxGlucose = 0
  if (spikes.length > 0) {
    maxGlucose = Math.max(...spikes.map((e) => e.extreme_glucose))
  }
  let minGlucose = 0
  if (dips.length > 0) {
    minGlucose = Math.min(...dips.map((e) => e.extreme_glucose))
  }
  return {
    nSpikes: spikes.length,
    nDips: dips.length,
    nDays: uniqueCalendarDays,
    meanConf,
    maxGlucoseSpike: maxGlucose,
    minGlucoseDip: minGlucose,
  }
}
