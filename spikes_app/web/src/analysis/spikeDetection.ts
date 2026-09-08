/**
 * TypeScript port of spike_analysis/spike_detection.py — detect_events, reshape_wide_to_long,
 * fft_decompose_cgm, _detect_single_direction, _deduplicate_events.
 * Matches SPIKES_app.py pipeline (defaults; Streamlit fft_* kwargs are not applied in Python).
 */

import {
  absComplex,
  fftfreq,
  numpyFft,
  numpyIfft,
  type Complex,
} from './fftUtils'

// ── PRESETS (same as Python) ────────────────────────────────────────────────

const PRESETS_SPIKE = {
  high_confidence: {
    amp_thresh: 1.2,
    rise_rate_thresh: 0.025,
    rise_window_min: 15,
    min_above_min: 20,
    end_band: 0.3,
    refractory_min: 45,
    gate_mode: 'and' as const,
    require_return: true,
    max_event_duration_min: 300,
  },
  sensitive: {
    amp_thresh: 0.55,
    rise_rate_thresh: 0.012,
    rise_window_min: 20,
    min_above_min: 10,
    end_band: 0.4,
    refractory_min: 20,
    gate_mode: 'and' as const,
    require_return: false,
    max_event_duration_min: 180,
  },
}

const PRESETS_DIP = {
  high_confidence: {
    amp_thresh: 0.9,
    rise_rate_thresh: 0.02,
    rise_window_min: 15,
    min_above_min: 15,
    end_band: 0.3,
    refractory_min: 45,
    gate_mode: 'and' as const,
    require_return: true,
    max_event_duration_min: 300,
    absolute_thresh: 3.9,
  },
  sensitive: {
    amp_thresh: 0.4,
    rise_rate_thresh: 0.008,
    rise_window_min: 20,
    min_above_min: 10,
    end_band: 0.4,
    refractory_min: 20,
    gate_mode: 'and' as const,
    require_return: false,
    max_event_duration_min: 180,
    absolute_thresh: 4.2,
  },
}

export type LongRow = {
  person_id: string
  study_day: number
  date: string
  datetime: Date
  glucose_mmol_l: number
}

export type SpikeEvent = {
  Day: string
  start_time: Date
  end_time: Date
  peak_time: Date
  p_val: number
  range: number
  extreme_glucose: number
  baseline_at_extreme: number | null
  closure_reason: string
  direction: 'up' | 'down'
  tier: 'high_confidence' | 'sensitive'
}

export type AnnotatedRow = LongRow & {
  baseline_fft: number
  event_component: number
  denoised: number
  slope: number
  residual: number
}

const nanmedian = (arr: number[]): number => {
  const finite = arr.filter((x) => Number.isFinite(x))
  if (finite.length === 0) return Number.NaN
  finite.sort((a, b) => a - b)
  const m = Math.floor(finite.length / 2)
  return finite.length % 2 ? finite[m] : (finite[m - 1] + finite[m]) / 2
}

const interp1d = (g: Float64Array): void => {
  const nans: number[] = []
  for (let i = 0; i < g.length; i++) {
    if (Number.isNaN(g[i])) nans.push(i)
  }
  if (nans.length === 0) return
  const notNan = g
    .map((v, i) => (Number.isFinite(v) ? i : -1))
    .filter((i) => i >= 0)
  if (notNan.length >= 2) {
    for (const idx of nans) {
      g[idx] = 0
      let lo = -1
      let hi = -1
      for (let j = idx - 1; j >= 0; j--) {
        if (Number.isFinite(g[j])) {
          lo = j
          break
        }
      }
      for (let j = idx + 1; j < g.length; j++) {
        if (Number.isFinite(g[j])) {
          hi = j
          break
        }
      }
      if (lo >= 0 && hi >= 0) {
        const t = (idx - lo) / (hi - lo)
        g[idx] = g[lo] * (1 - t) + g[hi] * t
      } else if (lo >= 0) g[idx] = g[lo]
      else if (hi >= 0) g[idx] = g[hi]
      else g[idx] = 0
    }
  } else if (notNan.length === 1) {
    const v = g[notNan[0]]
    for (const idx of nans) g[idx] = v
  } else {
    g.fill(0)
  }
}

export function fftDecomposeCgm(
  glucose: Float64Array,
  sampleStepMin: number,
  baselineCutoffHours: number,
  noiseCutoffMin: number,
): {
  baseline: Float64Array
  events: Float64Array
  noise: Float64Array
  denoised: Float64Array
  freqs: Float64Array
  power: Float64Array
  g_interpolated: Float64Array
} {
  const n = glucose.length
  const g = new Float64Array(glucose)
  interp1d(g)

  let gMean = 0
  for (let i = 0; i < n; i++) gMean += g[i]
  gMean /= n
  const gCentered = new Float64Array(n)
  for (let i = 0; i < n; i++) gCentered[i] = g[i] - gMean

  const x: Complex[] = new Array(n)
  for (let i = 0; i < n; i++) x[i] = { re: gCentered[i], im: 0 }
  const G = numpyFft(x)

  const freqs = fftfreq(n, sampleStepMin / 60.0)
  const baselineCutoffFreq = 1.0 / baselineCutoffHours
  const noiseCutoffFreq = 60.0 / noiseCutoffMin

  const GBaseline = new Array<Complex>(n)
  const GEvents = new Array<Complex>(n)
  const GNoise = new Array<Complex>(n)
  for (let i = 0; i < n; i++) {
    const af = Math.abs(freqs[i])
    if (af <= baselineCutoffFreq) {
      GBaseline[i] = G[i]
      GEvents[i] = { re: 0, im: 0 }
      GNoise[i] = { re: 0, im: 0 }
    } else if (af >= noiseCutoffFreq) {
      GBaseline[i] = { re: 0, im: 0 }
      GEvents[i] = { re: 0, im: 0 }
      GNoise[i] = G[i]
    } else {
      GBaseline[i] = { re: 0, im: 0 }
      GEvents[i] = G[i]
      GNoise[i] = { re: 0, im: 0 }
    }
  }

  const baselineC = numpyIfft(GBaseline)
  const eventsC = numpyIfft(GEvents)
  const noiseC = numpyIfft(GNoise)
  const baseline = new Float64Array(n)
  const eventsComponent = new Float64Array(n)
  const noiseComponent = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    baseline[i] = baselineC[i].re + gMean
    eventsComponent[i] = eventsC[i].re
    noiseComponent[i] = noiseC[i].re
  }
  const denoised = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    denoised[i] = baseline[i] + eventsComponent[i]
  }

  const power = new Float64Array(Math.floor(n / 2))
  for (let i = 0; i < power.length; i++) {
    power[i] = (absComplex(G[i]) ** 2) / n
  }

  return {
    baseline,
    events: eventsComponent,
    noise: noiseComponent,
    denoised,
    freqs: fftfreq(n, sampleStepMin / 60.0),
    power,
    g_interpolated: g,
  }
}

type SingleDirParams = {
  amp_thresh: number
  rise_rate_thresh: number
  rise_window_min: number
  min_above_min: number
  end_band: number
  refractory_min: number
  gate_mode: 'and' | 'or'
  require_return: boolean
  max_event_duration_min: number
  absolute_thresh?: number
}

function detectSingleDirection(
  _gRaw: Float64Array,
  gDenoised: Float64Array,
  fftBaseline: Float64Array,
  _eventComponent: Float64Array,
  t: Date[],
  dayStr: string[],
  n: number,
  idxPerMin: number,
  noiseStd: number,
  dirn: 'up' | 'down',
  sampleStepMin: number,
  wAmp: number,
  wSlope: number,
  wDur: number,
  wReturn: number,
  wSnr: number,
  params: SingleDirParams,
): Omit<SpikeEvent, 'direction' | 'tier'>[] {
  const {
    amp_thresh: ampThresh,
    rise_rate_thresh: riseRateThresh,
    rise_window_min: riseWindowMin,
    min_above_min: minAboveMin,
    end_band: endBand,
    refractory_min: refractoryMin,
    gate_mode: gateMode,
    require_return: requireReturn,
    max_event_duration_min: maxEventDurationMin,
    absolute_thresh: absoluteThresh,
  } = params

  let gWork: Float64Array
  let B: Float64Array
  if (dirn === 'down') {
    gWork = new Float64Array(n)
    B = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      gWork[i] = -gDenoised[i]
      B[i] = -fftBaseline[i]
    }
  } else {
    gWork = gDenoised
    B = fftBaseline
  }

  const riseN = Math.floor(riseWindowMin * idxPerMin)
  const minAboveN = Math.max(1, Math.floor(minAboveMin * idxPerMin))
  const refractoryN = Math.floor(refractoryMin * idxPerMin)
  const maxEventN = Math.floor(maxEventDurationMin * idxPerMin)

  if (n < riseN + 1) return []

  const slope = new Float64Array(n)
  slope.fill(Number.NaN)
  for (let i = riseN; i < n; i++) {
    slope[i] = (gWork[i] - gWork[i - riseN]) / riseWindowMin
  }

  const promWindow = Math.floor(60 * idxPerMin)
  const prominence = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const lStart = Math.max(0, i - promWindow)
    const rEnd = Math.min(n, i + promWindow + 1)
    let lMin = gWork[i]
    for (let k = lStart; k <= i; k++) {
      if (gWork[k] < lMin) lMin = gWork[k]
    }
    let rMin = gWork[i]
    for (let k = i; k < rEnd; k++) {
      if (gWork[k] < rMin) rMin = gWork[k]
    }
    prominence[i] = gWork[i] - Math.max(lMin, rMin)
  }

  const events: Omit<SpikeEvent, 'direction' | 'tier'>[] = []
  let i = 0
  let inRefractoryUntil = -1

  while (i < n) {
    if (i < inRefractoryUntil) {
      if (!(Number.isFinite(B[i]) && gWork[i] <= B[i] + endBand)) {
        i += 1
        continue
      }
    }

    if (!Number.isFinite(B[i])) {
      i += 1
      continue
    }

    const ampOk = gWork[i] - B[i] >= ampThresh
    const slopeOk = Number.isFinite(slope[i]) && slope[i] >= riseRateThresh
    let absoluteOk = false
    if (dirn === 'down' && absoluteThresh !== undefined) {
      absoluteOk = -gWork[i] <= absoluteThresh
    }

    let triggered = false
    if (gateMode === 'or') {
      triggered = ampOk || slopeOk || absoluteOk
    } else {
      triggered = (ampOk && slopeOk) || absoluteOk
    }

    if (!triggered) {
      i += 1
      continue
    }

    const walkbackThresh = ampThresh * 0.4
    let startI = i
    while (
      startI - 1 >= 0 &&
      Number.isFinite(B[startI - 1]) &&
      gWork[startI - 1] - B[startI - 1] >= walkbackThresh
    ) {
      startI -= 1
    }

    let aboveCount = 0
    let k = startI
    while (k < n) {
      if (Number.isFinite(B[k]) && gWork[k] - B[k] >= ampThresh * 0.6) {
        aboveCount += 1
      } else {
        break
      }
      k += 1
      if (aboveCount >= minAboveN) break
    }

    if (aboveCount < minAboveN) {
      i += 1
      continue
    }

    let peakI = i
    let maxG = gWork[i]
    let minG = gWork[i]
    let j = i
    let closureReason: SpikeEvent['closure_reason'] = 'end_of_data'
    let endI = n - 1

    while (j < n) {
      if (gWork[j] > maxG) {
        maxG = gWork[j]
        peakI = j
      }
      if (gWork[j] < minG) minG = gWork[j]

      if (Number.isFinite(B[j]) && gWork[j] <= B[j] + endBand) {
        endI = j
        closureReason = 'return_to_baseline'
        break
      }

      if (j - startI >= maxEventN) {
        endI = j
        closureReason = 'timeout'
        break
      }
      j += 1
    }

    if (requireReturn && closureReason !== 'return_to_baseline') {
      i += 1
      continue
    }

    const eventRange = maxG - minG

    const peakBaseline = Number.isFinite(B[peakI]) ? B[peakI] : nanmedian(Array.from(B))
    const peakAmp = maxG - peakBaseline

    const ampExcess = Math.max(0, peakAmp - ampThresh)
    const ampScore = 1.0 - Math.exp(-ampExcess / (noiseStd + 1e-9))

    const slopeEnd = Math.min(endI, startI + Math.floor(30 * idxPerMin))
    let localMaxSlope = 0
    if (slopeEnd >= startI) {
      for (let q = startI; q <= slopeEnd; q++) {
        if (Number.isFinite(slope[q]) && slope[q] > localMaxSlope) localMaxSlope = slope[q]
      }
    } else {
      localMaxSlope = Number.isFinite(slope[i]) ? slope[i] : 0
    }
    const slopeExcess = Math.max(0, localMaxSlope - riseRateThresh)
    const slopeScore =
      1.0 - Math.exp(-slopeExcess / (noiseStd / Math.max(riseWindowMin, 1) + 1e-9))

    let above = 0
    for (let q = startI; q <= endI; q++) {
      if (Number.isFinite(B[q]) && gWork[q] - B[q] >= ampThresh * 0.6) above += 1
    }
    const durMin = above * sampleStepMin
    const durScore = Math.min(1, durMin / 60.0)

    const endGap =
      gWork[endI] - (Number.isFinite(B[endI]) ? B[endI] : nanmedian(Array.from(B)))
    let returnScore = 0.15
    if (closureReason === 'return_to_baseline' && Number.isFinite(endGap)) {
      returnScore = Math.max(
        0,
        Math.min(1, 1.0 - Math.max(0, endGap) / Math.max(endBand, 1e-9)),
      )
    } else if (closureReason === 'timeout') {
      returnScore = 0.25
    }

    const snr = peakAmp / (noiseStd + 1e-9)
    const snrScore = Math.max(0, Math.min(1, snr / 5.0))
    const promScore = Math.max(0, Math.min(1, prominence[peakI] / 2.0))

    const pVal = Math.max(
      0,
      Math.min(
        1,
        wAmp * ampScore +
          wSlope * slopeScore +
          wDur * durScore +
          wReturn * returnScore +
          wSnr * snrScore +
          0.05 * promScore,
      ),
    )

    let extremeGlucose: number
    let baselineAtExtreme: number | null
    if (dirn === 'down') {
      extremeGlucose = -maxG
      baselineAtExtreme = Number.isFinite(B[peakI]) ? -B[peakI] : null
    } else {
      extremeGlucose = maxG
      baselineAtExtreme = Number.isFinite(B[peakI]) ? B[peakI] : null
    }

    events.push({
      Day: dayStr[startI],
      start_time: t[startI],
      end_time: t[endI],
      peak_time: t[peakI],
      p_val: Math.round(pVal * 10000) / 10000,
      range: Math.round(eventRange * 1000) / 1000,
      extreme_glucose: Math.round(extremeGlucose * 1000) / 1000,
      baseline_at_extreme:
        baselineAtExtreme !== null && Number.isFinite(baselineAtExtreme)
          ? Math.round(baselineAtExtreme * 1000) / 1000
          : null,
      closure_reason: closureReason,
    })

    inRefractoryUntil = endI + refractoryN
    i = endI + 1
  }

  return events
}

function deduplicateEvents(events: SpikeEvent[]): SpikeEvent[] {
  if (events.length === 0) return []
  const tierPriority: Record<string, number> = { high_confidence: 0, sensitive: 1 }
  const sorted = [...events].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction.localeCompare(b.direction)
    const pa = tierPriority[a.tier] ?? 2
    const pb = tierPriority[b.tier] ?? 2
    if (pa !== pb) return pa - pb
    return a.start_time.getTime() - b.start_time.getTime()
  })

  const keep: SpikeEvent[] = []
  const directions: ('up' | 'down')[] = []
  if (sorted.some((e) => e.direction === 'down')) directions.push('down')
  if (sorted.some((e) => e.direction === 'up')) directions.push('up')
  for (const dirn of directions) {
    const dirEvents = sorted
      .filter((e) => e.direction === dirn)
      .sort((a, b) => {
        const pa = tierPriority[a.tier] ?? 2
        const pb = tierPriority[b.tier] ?? 2
        if (pa !== pb) return pa - pb
        return a.start_time.getTime() - b.start_time.getTime()
      })
    const kept: [number, number][] = []
    for (const row of dirEvents) {
      const st = row.start_time.getTime()
      const et = row.end_time.getTime()
      const overlaps = kept.some(([ks, ke]) => st <= ke && et >= ks)
      if (!overlaps) {
        keep.push(row)
        kept.push([st, et])
      }
    }
  }

  return keep.sort((a, b) => {
    const da = a.Day.localeCompare(b.Day)
    if (da !== 0) return da
    return a.start_time.getTime() - b.start_time.getTime()
  })
}

export type DetectEventsOptions = {
  mode?: 'high_confidence' | 'sensitive' | 'both'
  direction?: 'up' | 'down' | 'both'
  sampleStepMin?: number
  baselineCutoffHours?: number
  noiseCutoffMin?: number
  wAmp?: number
  wSlope?: number
  wDur?: number
  wReturn?: number
  wSnr?: number
  expectedNoiseMadFloor?: number
}

export function detectEvents(
  longRows: LongRow[],
  personId: string,
  opts: DetectEventsOptions = {},
): { events: SpikeEvent[]; annotated: AnnotatedRow[] } {
  const {
    mode = 'both',
    direction = 'both',
    sampleStepMin = 5,
    baselineCutoffHours = 1.5,
    noiseCutoffMin = 12.0,
    wAmp = 0.35,
    wSlope = 0.2,
    wDur = 0.15,
    wReturn = 0.1,
    wSnr = 0.15,
    expectedNoiseMadFloor = 0.05,
  } = opts

  const want = String(personId).trim()
  const d = longRows.filter((r) => String(r.person_id).trim() === want)
  if (d.length === 0) return { events: [], annotated: [] }

  d.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

  const n = d.length
  const g = new Float64Array(n)
  const t: Date[] = new Array(n)
  const dayStr: string[] = new Array(n)
  for (let i = 0; i < n; i++) {
    g[i] = d[i].glucose_mmol_l
    t[i] = d[i].datetime
    dayStr[i] = d[i].date
  }

  const idxPerMin = 1.0 / sampleStepMin

  const fftResult = fftDecomposeCgm(g, sampleStepMin, baselineCutoffHours, noiseCutoffMin)
  const fftBaseline = fftResult.baseline
  const eventComponent = fftResult.events
  const denoised = fftResult.denoised
  const noiseComponent = fftResult.noise

  let nMean = 0
  for (let i = 0; i < n; i++) nMean += noiseComponent[i]
  nMean /= n
  let nVar = 0
  for (let i = 0; i < n; i++) nVar += (noiseComponent[i] - nMean) ** 2
  let noiseStd = Math.sqrt(nVar / n)
  noiseStd = Math.max(noiseStd, expectedNoiseMadFloor)

  const directions: ('up' | 'down')[] = []
  if (direction === 'up' || direction === 'both') directions.push('up')
  if (direction === 'down' || direction === 'both') directions.push('down')

  const modes: ('high_confidence' | 'sensitive')[] = []
  if (mode === 'high_confidence' || mode === 'both') modes.push('high_confidence')
  if (mode === 'sensitive' || mode === 'both') modes.push('sensitive')

  const allEvents: SpikeEvent[] = []

  for (const dirn of directions) {
    for (const m of modes) {
      const preset = (dirn === 'up' ? PRESETS_SPIKE : PRESETS_DIP)[m]
      const evs = detectSingleDirection(
        g,
        denoised,
        fftBaseline,
        eventComponent,
        t,
        dayStr,
        n,
        idxPerMin,
        noiseStd,
        dirn,
        sampleStepMin,
        wAmp,
        wSlope,
        wDur,
        wReturn,
        wSnr,
        preset,
      )
      for (const ev of evs) {
        allEvents.push({
          ...ev,
          direction: dirn,
          tier: m,
        })
      }
    }
  }

  let events = deduplicateEvents(allEvents)

  const riseN = Math.floor(20 * idxPerMin)
  const slope = new Float64Array(n)
  slope.fill(Number.NaN)
  for (let i = riseN; i < n; i++) {
    slope[i] = (denoised[i] - denoised[i - riseN]) / 20.0
  }

  const annotated: AnnotatedRow[] = d.map((row, i) => ({
    ...row,
    baseline_fft: fftBaseline[i],
    event_component: eventComponent[i],
    denoised: denoised[i],
    slope: slope[i],
    residual: g[i] - fftBaseline[i],
  }))

  return { events, annotated }
}

const HH_MM = /^\d{1,2}:\d{2}$/

/** Wide CGM CSV → long rows (matches reshape_wide_to_long). */
export function reshapeWideToLong(
  rows: Record<string, string>[],
  columns: string[],
  idCol = 'Client ID',
  dayCol = 'Day',
  referenceDate = '2025-01-01',
): LongRow[] {
  const norm = (s: string) => s.replace(/^\uFEFF/, '').trim()
  const cols = columns.map(norm)
  const idKey = cols.find((c) => c === norm(idCol)) ?? norm(idCol)
  const dayKey = cols.find((c) => c === norm(dayCol)) ?? norm(dayCol)
  const timeCols = cols.filter((c) => c !== idKey && c !== dayKey && HH_MM.test(c))
  const out: LongRow[] = []
  const ref = new Date(referenceDate + 'T00:00:00')

  for (const row of rows) {
    const pid = String(row[idKey] ?? '').trim()
    if (!pid) continue
    const dayRaw = row[dayKey]
    const dayNum = parseInt(String(dayRaw ?? ''), 10)
    if (!Number.isFinite(dayNum)) continue
    const synth = new Date(ref)
    synth.setDate(ref.getDate() + (dayNum - 1))
    const y = synth.getFullYear()
    const mo = String(synth.getMonth() + 1).padStart(2, '0')
    const da = String(synth.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${da}`

    for (const tc of timeCols) {
      const raw = row[tc]
      if (raw === undefined || raw === '') continue
      const glu = parseFloat(String(raw))
      if (!Number.isFinite(glu)) continue
      const dt = new Date(`${dateStr}T${tc}:00`)
      if (Number.isNaN(dt.getTime())) continue
      out.push({
        person_id: pid,
        study_day: dayNum,
        date: dateStr,
        datetime: dt,
        glucose_mmol_l: glu,
      })
    }
  }

  out.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
  return out
}
