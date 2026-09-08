import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { useDatasets } from '../context/DatasetProvider'
import type { AnnotatedRow, SpikeEvent } from '../analysis/spikeDetection'
import { runCgmDetect } from '../analysis/cgmWorkerClient'
import { ClinicalInsight } from '../components/insights/ClinicalInsight'
import {
  insightCgmDaysAnalysed,
  insightCgmDipCount,
  insightCgmDipNadir,
  insightCgmMeanConfidence,
  insightCgmPeakSpike,
  insightCgmSpikeCount,
  insightTimeOfDayPie,
  type ClinicalInsightData,
} from '../insights/clinicalDerivation'
import {
  classifyTimeOfDay,
  computeSummaryMetrics,
  defaultActiveLayers,
  eventMatchesLayers,
  findCgmWideDataset,
  PERIOD_COLOURS,
  PERIOD_ORDER,
  type ActiveLayerKey,
} from '../cgm/cgmHelpers'

const layerLabels: Record<ActiveLayerKey, string> = {
  spike_hc: 'Hard Spikes',
  spike_sens: 'Soft Spikes',
  dip_hc: 'Hard Dips',
  dip_sens: 'Soft Dips',
}

const eventStyle = (dir: SpikeEvent['direction'], tier: SpikeEvent['tier']) => {
  const key = `${dir}-${tier}` as const
  const map: Record<string, { fill: string; fillOpacity: number }> = {
    'up-high_confidence': { fill: '#E8453C', fillOpacity: 0.18 },
    'up-sensitive': { fill: '#F5A623', fillOpacity: 0.12 },
    'down-high_confidence': { fill: '#3B7DD8', fillOpacity: 0.18 },
    'down-sensitive': { fill: '#7EC8E3', fillOpacity: 0.12 },
  }
  return map[key] ?? { fill: '#999', fillOpacity: 0.15 }
}

const ShimmerSweep = ({ className }: { className?: string }) => (
  <div
    className={`pointer-events-none absolute inset-y-0 left-0 w-[45%] -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/10 ${className ?? ''}`}
    aria-hidden="true"
  />
)

const MetricCardShimmer = () => (
  <div className="rounded-lg border border-l-4 border-zinc-200/80 border-l-zinc-300 bg-white/70 py-2.5 pl-3 pr-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
    <div className="relative h-3 w-20 overflow-hidden rounded bg-zinc-200/75 dark:bg-zinc-700/45">
      <ShimmerSweep />
    </div>
    <div className="relative mt-2 h-7 w-14 overflow-hidden rounded bg-zinc-200/75 dark:bg-zinc-700/45">
      <ShimmerSweep />
    </div>
  </div>
)

/** Matches TimeOfDayPie card size (~220px) with donut-shaped skeleton. */
const TimeOfDayPieShimmer = ({ title }: { title: string }) => (
  <div
    className="rounded-xl border border-zinc-200/70 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/40"
    role="status"
    aria-busy="true"
    aria-label={`Loading ${title}`}
  >
    <div className="relative mx-auto mb-2 h-4 w-[85%] overflow-hidden rounded-md bg-zinc-200/75 dark:bg-zinc-700/45">
      <ShimmerSweep />
    </div>
    <div className="relative mx-auto flex h-[200px] max-w-[200px] items-center justify-center">
      <div className="relative size-[144px] shrink-0 rounded-full border-[10px] border-zinc-200/80 bg-zinc-100/40 dark:border-zinc-700/55 dark:bg-zinc-800/30">
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="absolute inset-0 opacity-80">
            <div
              className="absolute -inset-[35%] rotate-12 bg-gradient-to-tr from-zinc-200/40 via-white/45 to-zinc-200/40 dark:from-zinc-700/25 dark:via-white/8 dark:to-zinc-700/25"
              aria-hidden="true"
            />
            <ShimmerSweep />
          </div>
        </div>
        <div className="absolute inset-[22%] rounded-full border border-zinc-200/60 bg-white/50 dark:border-zinc-600/50 dark:bg-zinc-900/40" />
      </div>
    </div>
    <p className="mt-1 text-center text-[11px] font-bold text-slate-800 dark:text-zinc-100">{title}</p>
  </div>
)

const BreakdownTableShimmer = () => (
  <div className="glass-card overflow-hidden" aria-hidden="true">
    <div className="relative h-10 w-full overflow-hidden border-b border-zinc-200/70 bg-zinc-100/50 dark:border-zinc-700 dark:bg-zinc-800/40">
      <ShimmerSweep />
    </div>
    <div className="space-y-0 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="relative h-8 w-full overflow-hidden border-b border-zinc-100/80 dark:border-zinc-800/60"
        >
          <ShimmerSweep />
        </div>
      ))}
    </div>
  </div>
)

const DayTracesShimmer = () => (
  <div className="space-y-4" aria-hidden="true">
    {Array.from({ length: 2 }).map((_, i) => (
      <div
        key={i}
        className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/50 dark:border-zinc-700 dark:bg-zinc-900/35"
      >
        <div className="relative h-10 overflow-hidden border-b border-zinc-200/70 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-800/60">
          <ShimmerSweep />
        </div>
        <div className="relative h-[260px] w-full overflow-hidden p-2">
          <ShimmerSweep />
        </div>
      </div>
    ))}
  </div>
)

const MetricCard = ({
  label,
  value,
  accent,
  insight,
}: {
  label: string
  value: string | number
  accent: 'spike' | 'dip' | 'days' | 'conf' | 'glucose'
  insight?: ClinicalInsightData | null
}) => {
  const border =
    accent === 'spike'
      ? 'border-l-[#e94560]'
      : accent === 'dip'
        ? 'border-l-[#3B7DD8]'
        : accent === 'days'
          ? 'border-l-[#0f3460]'
          : accent === 'conf'
            ? 'border-l-[#e9a045]'
            : 'border-l-[#45e980]'
  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-zinc-200/80 bg-white/70 py-2.5 pl-3 pr-2 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/50 ${border} border-l-4`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-zinc-50">
        {value}
      </p>
      {insight ? (
        <div className="mt-2 min-h-0 flex-1">
          <ClinicalInsight tone={insight.tone}>{insight.text}</ClinicalInsight>
        </div>
      ) : null}
    </div>
  )
}

/** HTML legend below the pie — avoids clipped Recharts slice labels in narrow columns. */
const TimeOfDayPieLegend = ({
  data,
  sum,
}: {
  data: { name: string; value: number; color: string }[]
  sum: number
}) => (
  <ul
    className="mt-2 grid w-full grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-2"
    aria-label="Period breakdown"
  >
    {data.map((d) => {
      const v = d.value
      if (!Number.isFinite(v) || v <= 0) return null
      const pct = sum > 0 ? (v / sum) * 100 : 0
      return (
        <li
          key={d.name}
          className="flex min-w-0 items-baseline gap-1.5 rounded-md bg-zinc-50/80 px-1.5 py-1 dark:bg-zinc-900/35"
        >
          <span
            className="mt-0.5 size-2.5 shrink-0 rounded-sm ring-1 ring-white/50 dark:ring-zinc-600/50"
            style={{ backgroundColor: d.color }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-[10px] font-semibold leading-tight text-slate-800 dark:text-zinc-100">
            {d.name}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-slate-600 dark:text-zinc-400">
            {pct.toFixed(0)}%
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500">
            ({v.toFixed(1)}/d)
          </span>
        </li>
      )
    })}
  </ul>
)

const TimeOfDayPie = ({
  title,
  data,
  chartKey,
  insight,
}: {
  title: string
  data: { name: string; value: number; color: string }[]
  /** Forces Recharts to reset internal state per chart so slices/% stay tied to this data only. */
  chartKey: string
  insight?: ClinicalInsightData | null
}) => {
  const sum = data.reduce((s, d) => s + d.value, 0)
  const pieData = data.filter((d) => d.value > 1e-12)

  if (sum <= 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/30">
        <p className="text-xs font-medium text-zinc-400">No events</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">{title}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-zinc-200/70 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="mb-1 shrink-0 text-center text-[11px] font-bold text-slate-800 dark:text-zinc-100">{title}</p>
      <div className="relative mx-auto w-full max-w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height={168}>
          <PieChart key={chartKey} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="32%"
              outerRadius="78%"
              paddingAngle={1}
              startAngle={90}
              endAngle={-270}
              label={false}
            >
              {pieData.map((entry, i) => (
                <Cell key={`${chartKey}-${entry.name}-${i}`} fill={entry.color} stroke="white" strokeWidth={1.5} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`${Number(v).toFixed(2)} avg events/day`, '']}
              contentStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <TimeOfDayPieLegend data={data} sum={sum} />
      {insight ? (
        <div className="mt-2 shrink-0">
          <ClinicalInsight tone={insight.tone}>{insight.text}</ClinicalInsight>
        </div>
      ) : null}
    </div>
  )
}

const DayTracePanel = ({
  dayLabel,
  studyDay,
  rows,
  events,
  showBaseline,
}: {
  dayLabel: string
  studyDay: number
  rows: AnnotatedRow[]
  events: SpikeEvent[]
  showBaseline: boolean
}) => {
  const chartData = rows.map((r) => ({
    t: r.datetime.getTime(),
    label: r.datetime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    glucose: r.glucose_mmol_l,
    baseline: r.baseline_fft,
    eventC: r.event_component,
  }))

  const nSpikes = events.filter((e) => e.direction === 'up').length
  const nDips = events.filter((e) => e.direction === 'down').length
  let badge = 'No events'
  if (nSpikes || nDips) {
    const parts: string[] = []
    if (nSpikes) parts.push(`${nSpikes} spike${nSpikes === 1 ? '' : 's'}`)
    if (nDips) parts.push(`${nDips} dip${nDips === 1 ? '' : 's'}`)
    badge = parts.join(' · ')
  }

  const dayTraceInsight = useMemo((): ClinicalInsightData => {
    if (events.length === 0) {
      return {
        tone: 'neutral',
        text: 'No SPIKES events on this trace with current layer filters — widen layers or check alignment.',
      }
    }
    const total = nSpikes + nDips
    if (nSpikes > nDips * 2) {
      return {
        tone: 'warning',
        text: `Spike-heavy day (${nSpikes} spike vs ${nDips} dip events) — correlate with meals, insulin, and activity.`,
      }
    }
    if (nDips > nSpikes * 2) {
      return {
        tone: 'warning',
        text: `Dip-heavy day (${nDips} dip vs ${nSpikes} spike events) — review hypoglycaemia risk, bolus, and basal timing.`,
      }
    }
    if (total > 8) {
      return {
        tone: 'warning',
        text: `High event burden (${total} events) — consider glycaemic variability, TIR, and treatment review.`,
      }
    }
    return {
      tone: 'positive',
      text: `Balanced spike/dip load (${nSpikes}↑ / ${nDips}↓) — interpret with time-of-day pies and clinical context.`,
    }
  }, [events, nSpikes, nDips])

  return (
    <motion.div
      layout
      className="mb-6 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/50 dark:border-zinc-700 dark:bg-zinc-900/35"
    >
      <div className="border-b border-zinc-200/70 bg-zinc-100/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
          Day {studyDay}{' '}
          <span className="font-normal text-slate-500 dark:text-zinc-400">· {badge}</span>
        </p>
        <p className="text-[10px] text-zinc-500">{dayLabel}</p>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.5} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ms) =>
                new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 10 }}
              label={{ value: 'mmol/L', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <Tooltip
              labelFormatter={(ms) => new Date(ms as number).toLocaleString()}
              formatter={(v, name) => [typeof v === 'number' ? v.toFixed(2) : String(v), String(name)]}
            />
            <ReferenceLine y={3.9} stroke="#3B7DD8" strokeDasharray="4 3" strokeOpacity={0.45} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {events.map((ev, idx) => {
              const st = ev.start_time.getTime()
              const et = ev.end_time.getTime()
              const sty = eventStyle(ev.direction, ev.tier)
              return (
                <ReferenceArea
                  key={`ev-${idx}`}
                  x1={st}
                  x2={et}
                  strokeOpacity={0}
                  fill={sty.fill}
                  fillOpacity={sty.fillOpacity}
                />
              )
            })}
            {showBaseline ? (
              <Line type="monotone" dataKey="baseline" stroke="#94a3b8" dot={false} strokeWidth={1} name="Baseline" />
            ) : null}
            <Line
              type="monotone"
              dataKey="glucose"
              stroke="#166534"
              dot={false}
              strokeWidth={1.5}
              name="Glucose"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Event component</p>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.4} />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
              <YAxis tick={{ fontSize: 9 }} width={32} />
              <Area
                type="monotone"
                dataKey="eventC"
                stroke="#374151"
                fill="#cbd5e1"
                fillOpacity={0.35}
                strokeWidth={0.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="border-t border-zinc-200/70 bg-zinc-50/40 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900/25">
          <ClinicalInsight tone={dayTraceInsight.tone}>{dayTraceInsight.text}</ClinicalInsight>
        </div>
      </div>
    </motion.div>
  )
}

export const CgmPage = () => {
  const { datasets, selectedPatientId } = useDatasets()
  const deferredPatient = useDeferredValue(selectedPatientId)
  const [layers, setLayers] = useState(defaultActiveLayers)
  const [showBaseline, setShowBaseline] = useState(true)
  const [analysis, setAnalysis] = useState<{
    events: SpikeEvent[]
    annotated: AnnotatedRow[]
  } | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [, startTransition] = useTransition()

  const cgmDataset = useMemo(() => findCgmWideDataset(datasets), [datasets])

  useEffect(() => {
    if (!cgmDataset || !deferredPatient) {
      setAnalysis(null)
      setAnalysisLoading(false)
      return
    }
    let cancelled = false
    setAnalysis(null)
    setAnalysisLoading(true)
    runCgmDetect({
      datasetId: cgmDataset.id,
      rows: cgmDataset.rows,
      columns: cgmDataset.columns,
      patientId: deferredPatient,
    })
      .then((r) => {
        if (cancelled) return
        startTransition(() => {
          setAnalysis({ events: r.events, annotated: r.annotated })
        })
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cgmDataset, deferredPatient])

  const filteredEvents = useMemo(() => {
    if (!analysis) return []
    return analysis.events.filter((e) => eventMatchesLayers(e, layers))
  }, [analysis, layers])

  const uniqueDays = useMemo(() => {
    if (!analysis) return 0
    const dates = new Set(analysis.annotated.map((a) => a.date))
    return dates.size
  }, [analysis])

  const metrics = useMemo(
    () => computeSummaryMetrics(filteredEvents, uniqueDays),
    [filteredEvents, uniqueDays],
  )

  const timeOfDayPies = useMemo(() => {
    const nDays = Math.max(uniqueDays, 1)
    const spikeEv = filteredEvents.filter((e) => e.direction === 'up')
    const dipEv = filteredEvents.filter((e) => e.direction === 'down')

    const countPeriod = (evs: SpikeEvent[]) => {
      const m = new Map<string, number>()
      for (const p of PERIOD_ORDER) m.set(p, 0)
      for (const e of evs) {
        const h = e.peak_time.getHours()
        const period = classifyTimeOfDay(h)
        m.set(period, (m.get(period) ?? 0) + 1)
      }
      return PERIOD_ORDER.map((p) => ({ name: p, raw: m.get(p) ?? 0, value: (m.get(p) ?? 0) / nDays }))
    }

    const spikes = countPeriod(spikeEv)
    const dips = countPeriod(dipEv)
    const all = countPeriod(filteredEvents)

    const toPie = (arr: { name: string; value: number }[]) =>
      arr.map((d) => ({
        name: d.name,
        value: d.value,
        color: PERIOD_COLOURS[d.name as (typeof PERIOD_ORDER)[number]],
      }))

    return {
      spikes: toPie(spikes),
      dips: toPie(dips),
      all: toPie(all),
    }
  }, [filteredEvents, uniqueDays])

  const pieSum = (pie: { value: number }[]) => pie.reduce((s, d) => s + d.value, 0)

  const spikePieInsight = useMemo(() => {
    const s = pieSum(timeOfDayPies.spikes)
    return insightTimeOfDayPie(
      'spikes',
      timeOfDayPies.spikes.map((d) => ({ name: d.name, value: d.value })),
      s,
    )
  }, [timeOfDayPies.spikes])

  const dipPieInsight = useMemo(() => {
    const s = pieSum(timeOfDayPies.dips)
    return insightTimeOfDayPie(
      'dips',
      timeOfDayPies.dips.map((d) => ({ name: d.name, value: d.value })),
      s,
    )
  }, [timeOfDayPies.dips])

  const allPieInsight = useMemo(() => {
    const s = pieSum(timeOfDayPies.all)
    return insightTimeOfDayPie(
      'all',
      timeOfDayPies.all.map((d) => ({ name: d.name, value: d.value })),
      s,
    )
  }, [timeOfDayPies.all])

  const cgmCardInsights = useMemo(
    () => ({
      spikes: insightCgmSpikeCount(metrics.nSpikes, metrics.nDays),
      dips: insightCgmDipCount(metrics.nDips, metrics.nDays),
      days: insightCgmDaysAnalysed(metrics.nDays),
      conf: insightCgmMeanConfidence(metrics.meanConf),
      peak: insightCgmPeakSpike(metrics.maxGlucoseSpike, metrics.nSpikes > 0),
      nadir: insightCgmDipNadir(metrics.minGlucoseDip, metrics.nDips > 0),
    }),
    [metrics],
  )

  const breakdownTable = useMemo(() => {
    const nDays = Math.max(uniqueDays, 1)
    const spikeEv = filteredEvents.filter((e) => e.direction === 'up')
    const dipEv = filteredEvents.filter((e) => e.direction === 'down')
    const countRaw = (evs: SpikeEvent[]) => {
      const m = new Map<string, number>()
      for (const p of PERIOD_ORDER) m.set(p, 0)
      for (const e of evs) {
        const period = classifyTimeOfDay(e.peak_time.getHours())
        m.set(period, (m.get(period) ?? 0) + 1)
      }
      return PERIOD_ORDER.map((p) => m.get(p) ?? 0)
    }
    const spikeCounts = countRaw(spikeEv)
    const dipCounts = countRaw(dipEv)
    const spikeAvg = spikeCounts.map((c) => c / nDays)
    const dipAvg = dipCounts.map((c) => c / nDays)
    return PERIOD_ORDER.map((p, i) => ({
      period: p,
      timeRange: ['06:00 – 11:59', '12:00 – 17:59', '18:00 – 23:59', '00:00 – 05:59'][i],
      totalSpikes: spikeCounts[i],
      totalDips: dipCounts[i],
      avgSpikes: spikeAvg[i].toFixed(2),
      avgDips: dipAvg[i].toFixed(2),
    }))
  }, [filteredEvents, uniqueDays])

  const dayGroups = useMemo(() => {
    if (!analysis) return []
    const map = new Map<number, AnnotatedRow[]>()
    for (const row of analysis.annotated) {
      const list = map.get(row.study_day) ?? []
      list.push(row)
      map.set(row.study_day, list)
    }
    const dayToDates = new Map<number, Set<string>>()
    for (const row of analysis.annotated) {
      if (!dayToDates.has(row.study_day)) dayToDates.set(row.study_day, new Set())
      dayToDates.get(row.study_day)!.add(row.date)
    }
    const days = [...map.keys()].sort((a, b) => a - b)
    return days.map((studyDay) => {
      const rows = (map.get(studyDay) ?? []).sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
      const calDates = dayToDates.get(studyDay) ?? new Set()
      let evDay = filteredEvents.filter((ev) => calDates.has(ev.Day.slice(0, 10)))
      if (evDay.length === 0 && rows.length > 0) {
        const t0 = rows[0].datetime.getTime()
        const t1 = rows[rows.length - 1].datetime.getTime()
        evDay = filteredEvents.filter((ev) => {
          const st = ev.start_time.getTime()
          return st >= t0 && st <= t1
        })
      }
      const first = rows[0]
      const dayLabel = first ? first.date : `Day ${studyDay}`
      return { studyDay, rows, events: evDay, dayLabel }
    })
  }, [analysis, filteredEvents])

  const handleLayerToggle = (key: ActiveLayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const hasActiveLayer = Object.values(layers).some(Boolean)

  if (!cgmDataset) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">CGM Event Analysis</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Upload a CGM wide CSV (<span className="font-mono text-xs">Client ID</span>,{' '}
          <span className="font-mono text-xs">Day</span>, 00:00–23:55 columns) on the Data upload page.
        </p>
      </section>
    )
  }

  if (!selectedPatientId) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">CGM Event Analysis</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Select a patient from the header.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <motion.div
        key={deferredPatient ?? 'none'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="glass-card mb-4 p-4 sm:p-5">
          <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
            CGM Event Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Patient <span className="font-mono font-medium text-wellness-700 dark:text-wellness-400">{deferredPatient}</span>{' '}
            · same detection pipeline as SPIKES_app.py (FFT baseline, dual tiers).
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <p className="w-full text-[10px] font-bold uppercase tracking-wide text-zinc-500">Detection layers</p>
            {(Object.keys(layerLabels) as ActiveLayerKey[]).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200/80 bg-white/60 px-2.5 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-800/60"
              >
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => handleLayerToggle(key)}
                  className="rounded border-zinc-400 text-wellness-600 focus:ring-wellness-500"
                />
                <span>{layerLabels[key]}</span>
              </label>
            ))}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-slate-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={() => setShowBaseline((v) => !v)}
              className="rounded border-zinc-400 text-wellness-600"
            />
            Show FFT baseline on traces
          </label>
        </div>

        <AnimatePresence mode="wait">
          {!hasActiveLayer ? (
            <motion.div
              key="warn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
            >
              Enable at least one detection layer to view metrics and charts.
            </motion.div>
          ) : null}
        </AnimatePresence>

        {hasActiveLayer && analysisLoading ? (
          <motion.div
            key={`${deferredPatient}-loading`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
            aria-busy="true"
            aria-label="Running CGM spike detection"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <MetricCardShimmer key={i} />
              ))}
            </div>

            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
                Events by Time of Day
              </h2>
              <p className="text-[11px] text-zinc-500">
                Average events per day across study days (matches SPIKES_app.py pie logic).
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-wellness-700 dark:text-wellness-400/90">
                Computing breakdown…
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TimeOfDayPieShimmer title="Spikes by Time of Day" />
                <TimeOfDayPieShimmer title="Dips by Time of Day" />
                <TimeOfDayPieShimmer title="All Events by Time of Day" />
              </div>
            </div>

            <div>
              <div className="mb-2 font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
                Time-of-Day Breakdown Table
              </div>
              <BreakdownTableShimmer />
            </div>

            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
                Daily Glucose Traces
              </h2>
              <p className="text-[11px] text-zinc-500">Loading traces…</p>
              <div className="mt-3">
                <DayTracesShimmer />
              </div>
            </div>
          </motion.div>
        ) : null}

        {hasActiveLayer && analysis && !analysisLoading ? (
          <motion.div
            key={`${deferredPatient}-content`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="Spikes Detected"
                value={metrics.nSpikes}
                accent="spike"
                insight={cgmCardInsights.spikes}
              />
              <MetricCard
                label="Dips Detected"
                value={metrics.nDips}
                accent="dip"
                insight={cgmCardInsights.dips}
              />
              <MetricCard
                label="Days Analysed"
                value={metrics.nDays}
                accent="days"
                insight={cgmCardInsights.days}
              />
              <MetricCard
                label="Mean Confidence"
                value={metrics.meanConf.toFixed(2)}
                accent="conf"
                insight={cgmCardInsights.conf}
              />
              <MetricCard
                label="Highest Spike (mmol/L)"
                value={metrics.nSpikes > 0 ? metrics.maxGlucoseSpike.toFixed(1) : '0.0'}
                accent="glucose"
                insight={cgmCardInsights.peak}
              />
              <MetricCard
                label="Deepest dip nadir (mmol/L)"
                value={metrics.nDips > 0 ? metrics.minGlucoseDip.toFixed(1) : '—'}
                accent="dip"
                insight={cgmCardInsights.nadir}
              />
            </div>

            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
                Events by Time of Day
              </h2>
              <p className="text-[11px] text-zinc-500">
                Average events per day across {uniqueDays} day(s) (matches SPIKES_app.py pie logic).
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TimeOfDayPie
                  chartKey={`tod-spikes-${deferredPatient}-${filteredEvents.filter((e) => e.direction === 'up').length}`}
                  title="Spikes by Time of Day"
                  data={timeOfDayPies.spikes}
                  insight={spikePieInsight}
                />
                <TimeOfDayPie
                  chartKey={`tod-dips-${deferredPatient}-${filteredEvents.filter((e) => e.direction === 'down').length}`}
                  title="Dips by Time of Day"
                  data={timeOfDayPies.dips}
                  insight={dipPieInsight}
                />
                <TimeOfDayPie
                  chartKey={`tod-all-${deferredPatient}-${filteredEvents.length}`}
                  title="All Events by Time of Day"
                  data={timeOfDayPies.all}
                  insight={allPieInsight}
                />
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-zinc-100"
                aria-expanded
              >
                Time-of-Day Breakdown Table
              </button>
              <div className="overflow-x-auto border-t border-zinc-200/70 dark:border-zinc-700">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead className="bg-zinc-100/90 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Period</th>
                      <th className="px-3 py-2 font-semibold">Time Range</th>
                      <th className="px-3 py-2 font-semibold">Total Spikes</th>
                      <th className="px-3 py-2 font-semibold">Total Dips</th>
                      <th className="px-3 py-2 font-semibold">Avg Spikes/Day</th>
                      <th className="px-3 py-2 font-semibold">Avg Dips/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownTable.map((row) => (
                      <tr
                        key={row.period}
                        className="border-t border-zinc-200/60 odd:bg-white/50 even:bg-zinc-50/40 dark:border-zinc-700 dark:odd:bg-zinc-900/25 dark:even:bg-zinc-800/20"
                      >
                        <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-zinc-100">{row.period}</td>
                        <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{row.timeRange}</td>
                        <td className="px-3 py-1.5 tabular-nums">{row.totalSpikes}</td>
                        <td className="px-3 py-1.5 tabular-nums">{row.totalDips}</td>
                        <td className="px-3 py-1.5 tabular-nums">{row.avgSpikes}</td>
                        <td className="px-3 py-1.5 tabular-nums">{row.avgDips}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
                Daily Glucose Traces
              </h2>
              <div className="mt-3 space-y-4">
                {dayGroups.map((g) => (
                  <DayTracePanel
                    key={g.studyDay}
                    studyDay={g.studyDay}
                    dayLabel={g.dayLabel}
                    rows={g.rows}
                    events={g.events}
                    showBaseline={showBaseline}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  )
}
