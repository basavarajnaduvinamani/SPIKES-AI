import { useDeferredValue, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  ComposedChart,
} from 'recharts'
import { ClinicalInsight } from '../components/insights/ClinicalInsight'
import {
  insightCohortPillarTrend,
  insightNegativeAffect,
  insightPillarCard,
  insightPillarRadarBalance,
} from '../insights/clinicalDerivation'
import { useDatasets } from '../context/DatasetProvider'
import {
  cleanPillarsFromDataset,
  findPillarsDataset,
  gaugesTimeseriesData,
  negativeGaugeTimeseries,
  PILLAR_COLORS,
  PILLAR_NAMES,
  pillarMeansForRadar,
  patientSummary,
  trendDistributionData,
} from '../pillars/pillarAnalysis'

const trendIcon = (dominant: string | null) => {
  if (!dominant) return '—'
  if (dominant === 'improving') return '↑ Improving'
  if (dominant === 'declining') return '↓ Declining'
  return '→ Staying'
}

const negColor = (mean: number) => {
  if (mean >= 6) return '#ef4444'
  if (mean >= 4) return '#f59e0b'
  return '#22c55e'
}

export const LifestylePillarsPage = () => {
  const { datasets, selectedPatientId } = useDatasets()
  const deferredPatient = useDeferredValue(selectedPatientId)

  const pillarsFile = useMemo(() => findPillarsDataset(datasets), [datasets])

  const clean = useMemo(() => {
    if (!pillarsFile) return null
    return cleanPillarsFromDataset(pillarsFile)
  }, [pillarsFile])

  const summary = useMemo(() => {
    if (!clean || !deferredPatient) return null
    return patientSummary(clean, deferredPatient)
  }, [clean, deferredPatient])

  const radarData = useMemo(() => {
    if (!clean || !deferredPatient) return []
    return pillarMeansForRadar(clean, deferredPatient).map((d) => ({
      pillar: d.pillar,
      value: Number.isFinite(d.value) ? d.value : 0,
    }))
  }, [clean, deferredPatient])

  const trendBars = useMemo(() => {
    if (!clean || !deferredPatient) return []
    return trendDistributionData(clean, deferredPatient)
  }, [clean, deferredPatient])

  const tsData = useMemo(() => {
    if (!clean || !deferredPatient) return []
    return gaugesTimeseriesData(clean, deferredPatient)
  }, [clean, deferredPatient])

  const negTs = useMemo(() => {
    if (!clean || !deferredPatient) return []
    return negativeGaugeTimeseries(clean, deferredPatient)
  }, [clean, deferredPatient])

  const rawRows = useMemo(() => {
    if (!clean || !deferredPatient) return []
    return clean.rows.filter((r) => String(r[clean.idCol]).trim() === deferredPatient.trim())
  }, [clean, deferredPatient])

  const radarInsight = useMemo(() => {
    const vals = radarData.map((d) => d.value).filter((v) => Number.isFinite(v))
    return insightPillarRadarBalance(vals)
  }, [radarData])

  const cohortTrendInsight = useMemo(() => {
    if (!summary) return null
    const decliningDominantCount = PILLAR_NAMES.filter(
      (p) => summary.pillars[p]?.dominant_trend === 'declining',
    ).length
    return insightCohortPillarTrend((decliningDominantCount / PILLAR_NAMES.length) * 100)
  }, [summary])

  const negativeAffectInsight = useMemo(() => {
    if (!summary?.negative) return null
    return insightNegativeAffect(summary.negative.mean)
  }, [summary?.negative])

  if (!pillarsFile) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Lifestyle Pillars
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Upload a <strong className="font-medium">self-reported pillars</strong> CSV (gauges per day) on the Data
          upload page — same as SPIKES_app.py &quot;Self Reported Pillars&quot; file.
        </p>
      </section>
    )
  }

  if (!selectedPatientId) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Lifestyle Pillars
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Select a patient in the header.</p>
      </section>
    )
  }

  if (!summary || summary.n_days === 0) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Lifestyle Pillars
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
          No pillar data found for <span className="font-mono font-medium">{deferredPatient}</span>.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="glass-card mb-5 border-l-4 border-l-emerald-600 p-4 sm:p-5">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Lifestyle Pillars
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Self-reported daily gauges · Health · Sleep · Nutrition · Movement · Stress · Connection
        </p>
      </div>

      <motion.div
        key={deferredPatient ?? 'none'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">
          <span className="font-mono text-wellness-700 dark:text-wellness-400">{deferredPatient}</span>
          {' · '}
          {summary.n_days} days of self-reported data
        </p>

        <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PILLAR_NAMES.map((pillar) => {
            const pdata = summary.pillars[pillar]
            const meanVal = pdata?.mean
            const dominant = pdata?.dominant_trend ?? null
            const delta = pdata?.delta
            const color = PILLAR_COLORS[pillar]
            const scoreStr = meanVal !== null && meanVal !== undefined ? meanVal.toFixed(1) : '—'
            const deltaStr = delta !== null && delta !== undefined ? `Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : ''
            const pillarInsight = insightPillarCard(pillar, meanVal ?? null, dominant)

            return (
              <motion.div
                key={pillar}
                layout
                className="flex flex-col rounded-xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50"
                style={{ borderTopWidth: 3, borderTopColor: color }}
              >
                <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">{pillar}</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-zinc-50">
                  {scoreStr}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{trendIcon(dominant)}</p>
                {deltaStr ? (
                  <p className="mt-1 text-[11px] font-medium text-slate-700 dark:text-zinc-300">{deltaStr}</p>
                ) : null}
                <div className="mt-2 min-h-0 flex-1">
                  <ClinicalInsight tone={pillarInsight.tone}>{pillarInsight.text}</ClinicalInsight>
                </div>
              </motion.div>
            )
          })}
        </div>

        {summary.negative ? (
          <motion.div
            layout
            className="max-w-sm rounded-xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50"
            style={{ borderTopWidth: 3, borderTopColor: '#ef4444' }}
          >
            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">Negative Affect</p>
            <p
              className="mt-1 font-display text-xl font-bold tabular-nums"
              style={{ color: negColor(summary.negative.mean) }}
            >
              {summary.negative.mean.toFixed(1)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              range {summary.negative.min}–{summary.negative.max}
            </p>
            {negativeAffectInsight ? (
              <div className="mt-2">
                <ClinicalInsight tone={negativeAffectInsight.tone}>{negativeAffectInsight.text}</ClinicalInsight>
              </div>
            ) : null}
          </motion.div>
        ) : null}

        <div className="h-px bg-zinc-200/80 dark:bg-zinc-700" />

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
              Pillar Balance
            </h2>
            <div className="h-[300px] w-full max-w-md mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 9, fill: '#999' }} />
                  <Radar
                    name="Mean"
                    dataKey="value"
                    stroke="#4a90d9"
                    fill="#4a90d9"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[11px] text-zinc-500">{deferredPatient} · Average Pillar Scores</p>
            <div className="mt-2">
              <ClinicalInsight tone={radarInsight.tone}>{radarInsight.text}</ClinicalInsight>
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
              Trend Distribution
            </h2>
            {trendBars.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-600">
                No trend data available
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={trendBars}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={10} />
                    <YAxis type="category" dataKey="pillar" width={88} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === 'number' ? value : Number(value)
                        return Number.isFinite(n) ? `${n.toFixed(0)}%` : ''
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="improving" name="Improving" stackId="t" fill="#22c55e" />
                    <Bar dataKey="staying" name="Staying" stackId="t" fill="#6b7280" />
                    <Bar dataKey="declining" name="Declining" stackId="t" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-1 text-center text-[11px] text-zinc-500">{deferredPatient} · Trend Distribution</p>
            {cohortTrendInsight ? (
              <div className="mt-2">
                <ClinicalInsight tone={cohortTrendInsight.tone}>{cohortTrendInsight.text}</ClinicalInsight>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
            Gauges Over Time
          </h2>
          <div className="h-[320px] w-full rounded-xl border border-zinc-200/70 bg-white/50 p-2 dark:border-zinc-700 dark:bg-zinc-900/30">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tsData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} label={{ value: 'Study Day', fontSize: 10, position: 'insideBottom', offset: -2 }} />
                <YAxis domain={[0, 11]} tickCount={12} tick={{ fontSize: 10 }} label={{ value: 'Gauge (1–10)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {PILLAR_NAMES.map((pillar) => (
                  <Line
                    key={pillar}
                    type="monotone"
                    dataKey={pillar}
                    stroke={PILLAR_COLORS[pillar]}
                    strokeWidth={1.4}
                    dot={{ r: 3 }}
                    connectNulls
                    name={pillar}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {negTs.length > 0 ? (
          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-slate-900 dark:text-zinc-50">
              Negative Affect Over Time
            </h2>
            <div className="h-[220px] w-full rounded-xl border border-zinc-200/70 bg-white/50 p-2 dark:border-zinc-700 dark:bg-zinc-900/30">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={negTs} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 11]} tickCount={12} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="neg" fill="#ef4444" fillOpacity={0.12} stroke="none" />
                  <Line type="monotone" dataKey="neg" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Negative Gauge" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <details className="glass-card overflow-hidden rounded-xl">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-zinc-100">
            Raw Pillar Data
          </summary>
          <div className="max-h-[min(50vh,420px)] overflow-auto border-t border-zinc-200/70 dark:border-zinc-700">
            <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-zinc-100/95 dark:bg-zinc-800/95">
                <tr>
                  {rawRows[0]
                    ? Object.keys(rawRows[0]).map((k) => (
                        <th key={k} className="border-b border-zinc-200 px-2 py-1.5 font-semibold dark:border-zinc-600">
                          {k}
                        </th>
                      ))
                    : null}
                </tr>
              </thead>
              <tbody>
                {rawRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 odd:bg-white/60 even:bg-zinc-50/50 dark:border-zinc-800 dark:odd:bg-zinc-900/20 dark:even:bg-zinc-900/35"
                  >
                    {Object.keys(rawRows[0] ?? {}).map((k) => (
                      <td key={k} className="max-w-48 truncate px-2 py-1 font-mono text-zinc-800 dark:text-zinc-200" title={row[k]}>
                        {row[k] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </motion.div>
    </section>
  )
}
