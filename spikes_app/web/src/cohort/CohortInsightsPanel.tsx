import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { motion } from 'framer-motion'
import type { UploadedDataset } from '../types/dataset'
import { findCgmWideDataset, eventMatchesLayers, defaultActiveLayers } from '../cgm/cgmHelpers'
import {
  cleanPillarsFromDataset,
  findPillarsDataset,
  patientSummary,
  PILLAR_COLORS,
  PILLAR_NAMES,
  type PillarName,
} from '../pillars/pillarAnalysis'
import { runCgmDetect } from '../analysis/cgmWorkerClient'
import { pearsonCorrelationFromSeries } from './correlationStats'
import { findMetadataDataset, getPatientMetaRow, metaField } from '../overview/patientMetaResolve'

type CorrelationPoint = {
  patientId: string
  x: number // pillar gauge mean
  y: number // spike count
}

type PillarCorrelation = {
  pillar: PillarName
  points: CorrelationPoint[]
  n: number
  r: number
  p: number | null
  slope: number
  intercept: number
}

const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim()

const normalizeEthnicity = (raw: string): string => collapseWhitespace(String(raw).toLowerCase())

const classifyGender = (raw: string | undefined): string => {
  const s = raw ? collapseWhitespace(String(raw).toLowerCase()) : ''
  if (!s) return 'unknown'
  if (/female|woman|girl/.test(s)) return 'female'
  if (/male|man|boy/.test(s)) return 'male'
  if (/non[- ]?binary|nonbinary|nb|genderqueer|they\s*\/\s*them/.test(s)) return 'non-binary'
  if (/other|intersex|prefer not/.test(s)) return 'other'
  return s
}

type HealthGoalBucket = 'glucose' | 'weight' | 'sleep' | 'stress' | 'activity' | 'other'

const classifyHealthGoal = (raw: string | undefined): HealthGoalBucket => {
  const s = raw ? collapseWhitespace(String(raw).toLowerCase()) : ''
  if (!s) return 'other'
  if (
    /(hba1c|a1c|glucose|blood sugar|time in range|tir|insulin|diabetes|prediabet|reduce.*a1c|improve.*glucose)/i.test(s)
  ) {
    return 'glucose'
  }
  if (/(weight|bmi|lbs|kg|waist|lose weight|reduce weight)/i.test(s)) return 'weight'
  if (/(sleep|insomnia|rest|fatigue|chronotype)/i.test(s)) return 'sleep'
  if (/(stress|anxiety|mood|mental|burnout|overwhelm|depress)/i.test(s)) return 'stress'
  if (/(activity|exercise|fitness|steps|movement|cardio|strength)/i.test(s)) return 'activity'
  return 'other'
}

const bucketLabel = (b: HealthGoalBucket): string => {
  if (b === 'glucose') return 'Glucose control'
  if (b === 'weight') return 'Weight'
  if (b === 'sleep') return 'Sleep'
  if (b === 'stress') return 'Stress/Mental health'
  if (b === 'activity') return 'Activity/Movement'
  return 'Other'
}

const formatP = (p: number | null): string => {
  if (p === null) return 'n/a'
  if (p < 0.001) return '<0.001'
  return p.toFixed(3)
}

const interpret = (pillar: PillarName, r: number, p: number | null): string => {
  if (p === null) return `${pillar}: trend not testable with this cohort size.`
  if (p >= 0.05) return `${pillar}: correlation not statistically significant at p<0.05.`
  if (r >= 0.35) return `${pillar}: higher ${pillar} scores associate with higher spike count (priority pillar).`
  if (r <= -0.35) return `${pillar}: higher ${pillar} scores associate with fewer spikes (priority pillar).`
  return `${pillar}: statistically significant trend, but effect size is modest.`
}

const CorrelationPlot = ({ pillar, color, corr }: { pillar: PillarName; color: string; corr: PillarCorrelation }) => {
  const chartData = useMemo(() => {
    const pts = [...corr.points].sort((a, b) => a.x - b.x)
    return pts.map((p) => ({
      x: p.x,
      y: p.y,
      regressionY: corr.intercept + corr.slope * p.x,
      patientId: p.patientId,
    }))
  }, [corr.intercept, corr.points, corr.slope])

  const priority = corr.p !== null && corr.p < 0.05 && corr.n >= 3

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border bg-white/60 p-3 shadow-sm backdrop-blur-sm dark:bg-zinc-900/35 ${
        priority ? 'border-wellness-500/40' : 'border-zinc-200/70 dark:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {pillar}
            {priority ? <span className="ml-2 rounded-md bg-wellness-50 px-2 py-px text-[10px] font-semibold text-wellness-700 dark:bg-wellness-950/40 dark:text-wellness-200">Priority</span> : null}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
            r={corr.r.toFixed(2)} · p={formatP(corr.p)} · n={corr.n}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{interpret(pillar, corr.r, corr.p)}</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-2 flex h-[240px] items-center justify-center rounded-lg border border-dashed border-zinc-300/70 text-xs text-zinc-500">
          Not enough data points
        </div>
      ) : (
        <div className="mt-2 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" opacity={0.7} />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                label={{ value: `${pillar} gauge`, position: 'insideBottom', offset: -2, fontSize: 10 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fontSize: 10 }}
                allowDecimals={false}
                label={{ value: 'Spike Count', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <Tooltip
                cursor={{ stroke: color, strokeWidth: 1, fill: 'rgba(0,0,0,0.02)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const p = payload[0]?.payload as { x: number; y: number; patientId: string } | undefined
                  if (!p) return null
                  return (
                    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="font-bold text-slate-800 dark:text-zinc-100">{p.patientId}</div>
                      <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                        {pillar} gauge: <span className="font-mono">{p.x.toFixed(1)}</span>
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-300">
                        Spike count: <span className="font-mono">{p.y}</span>
                      </div>
                    </div>
                  )
                }}
              />

              {/* Regression line */}
              <Line dataKey="regressionY" type="linear" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />

              {/* Scatter points (use Line with transparent stroke + dots) */}
              <Line
                dataKey="y"
                type="linear"
                stroke="transparent"
                dot={{ r: 4, stroke: color, strokeWidth: 1, fill: '#ffffff' }}
                activeDot={{ r: 6, stroke: color, strokeWidth: 1.5, fill: '#ffffff' }}
                name="Patients"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}

const CohortCorrelationsEngine = ({
  datasets,
  patientIds,
}: {
  datasets: UploadedDataset[]
  patientIds: string[]
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [correlations, setCorrelations] = useState<Record<PillarName, PillarCorrelation> | null>(null)

  const cgmDataset = useMemo(() => findCgmWideDataset(datasets), [datasets])

  const metadataDataset = useMemo(() => findMetadataDataset(datasets), [datasets])

  const pillarsClean = useMemo(() => {
    const pillarsFile = findPillarsDataset(datasets)
    if (!pillarsFile) return null
    return cleanPillarsFromDataset(pillarsFile)
  }, [datasets])

  const cohortMeta = useMemo(() => {
    if (!metadataDataset) return null

    const points: {
      patientId: string
      age: number | null
      gender: string
      ethnicity: string
      healthGoalBucket: HealthGoalBucket
    }[] = []

    for (const pid of patientIds) {
      const row = getPatientMetaRow(metadataDataset, pid)
      if (!row) continue

      const ageRaw = metaField(row, 'Age')
      const ageN = Number.parseFloat(String(ageRaw ?? '').replace(/,/g, ''))
      const age = Number.isFinite(ageN) ? ageN : null

      const genderRaw = metaField(row, 'Sex Assigned')
      const ethnicityRaw = metaField(row, 'Ethnicity')
      const healthGoalRaw = metaField(row, 'Health Goal')

      const gender = classifyGender(genderRaw)
      const ethnicity = ethnicityRaw ? normalizeEthnicity(ethnicityRaw) : 'unknown'
      const healthGoalBucket = classifyHealthGoal(healthGoalRaw)

      points.push({ patientId: pid, age, gender, ethnicity, healthGoalBucket })
    }

    const n = points.length
    const ages = points.map((p) => p.age).filter((a): a is number => a !== null && Number.isFinite(a))
    const avgAge = ages.length ? ages.reduce((s, v) => s + v, 0) / ages.length : null

    const countBy = <T extends string>(keyFn: (p: typeof points[number]) => T) => {
      const m = new Map<T, number>()
      for (const p of points) {
        const k = keyFn(p)
        m.set(k, (m.get(k) ?? 0) + 1)
      }
      return [...m.entries()]
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value)
    }

    return {
      n,
      avgAge,
      genderDist: countBy((p) => p.gender),
      ethnicityDist: countBy((p) => p.ethnicity),
      healthGoalDist: countBy((p) => p.healthGoalBucket).map((d) => ({
        name: bucketLabel(d.name as HealthGoalBucket),
        value: d.value,
      })),
    }
  }, [metadataDataset, patientIds])

  const piePalette = useMemo(
    () => ['#4a90d9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#64748b', '#94a3b8'],
    [],
  )

  const PieSection = ({
    title,
    data,
    ariaLabel,
  }: {
    title: string
    data: { name: string; value: number }[]
    ariaLabel: string
  }) => {
    const sum = data.reduce((s, d) => s + d.value, 0)
    if (!sum) {
      return (
        <div className="rounded-xl border border-zinc-200/80 bg-white/40 p-3 dark:border-zinc-700 dark:bg-zinc-900/25">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No metadata distribution available.</p>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-zinc-200/80 bg-white/40 p-3 dark:border-zinc-700 dark:bg-zinc-900/25">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</p>
        <div className="mt-2 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={78}
                labelLine={false}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={`${d.name}-${i}`} fill={piePalette[i % piePalette.length]} aria-label={`${ariaLabel}: ${d.name}`} />
                ))}
              </Pie>
              <Tooltip
                isAnimationActive={false}
                contentStyle={{ fontSize: 11 }}
                formatter={(value: unknown) => {
                  const n = typeof value === 'number' ? value : Number(value)
                  return n.toFixed(0)
                }}
                labelFormatter={() => ''}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setError(null)
      setLoading(true)
      try {
        if (!cgmDataset) {
          setCorrelations(null)
          setError('No wide CGM matrix found for cohort analysis. Upload Day × time-grid CGM CSVs.')
          return
        }
        if (!pillarsClean) {
          setCorrelations(null)
          setError('No self-reported pillars CSV found for cohort analysis. Upload the pillars file with gauges.')
          return
        }

        const pointsByPillar: Record<PillarName, CorrelationPoint[]> = {
          Health: [],
          Sleep: [],
          Nutrition: [],
          Movement: [],
          Stress: [],
          Connection: [],
        }

        // Sequential on purpose: stable UI + easier to debug.
        for (let i = 0; i < patientIds.length; i++) {
          if (cancelled) return
          const pid = patientIds[i]?.trim()
          if (!pid) continue

          const ps = patientSummary(pillarsClean, pid)
          if (ps.n_days <= 0) continue

          // CGM spike count for this patient.
          const result = await runCgmDetect({
            datasetId: cgmDataset.id,
            rows: cgmDataset.rows,
            columns: cgmDataset.columns,
            patientId: pid,
          })
          const matching = result.events.filter((e) => eventMatchesLayers(e, defaultActiveLayers))
          const nSpikes = matching.filter((e) => e.direction === 'up').length

          for (const pillar of PILLAR_NAMES) {
            const mean = ps.pillars[pillar]?.mean
            if (mean === null || mean === undefined) continue
            pointsByPillar[pillar].push({ patientId: pid, x: mean, y: nSpikes })
          }

          // Yield a little every few iterations.
          if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0))
        }

        const out = {} as Record<PillarName, PillarCorrelation>
        for (const pillar of PILLAR_NAMES) {
          const pairs = pointsByPillar[pillar]
          const filteredPairs = pairs.map((p) => ({ x: p.x, y: p.y }))
          const corr = pearsonCorrelationFromSeries(filteredPairs)
          if (!corr) {
            out[pillar] = {
              pillar,
              points: pairs,
              n: pairs.length,
              r: 0,
              p: null,
              slope: 0,
              intercept: 0,
            }
          } else {
            out[pillar] = {
              pillar,
              points: pairs,
              n: corr.n,
              r: corr.r,
              p: corr.p,
              slope: corr.slope,
              intercept: corr.intercept,
            }
          }
        }

        if (cancelled) return
        setCorrelations(out)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to compute cohort correlations.'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [cgmDataset, pillarsClean, patientIds])

  const priority = useMemo(() => {
    if (!correlations) return []
    return PILLAR_NAMES.map((p) => correlations[p])
      .filter((c) => c.p !== null && c.p < 0.05 && c.n >= 3)
      .sort((a, b) => (a.p ?? 1) - (b.p ?? 1))
  }, [correlations])

  if (error) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-card p-4 sm:p-5"
      >
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">Cohort insights</h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">{error}</p>
      </motion.div>
    )
  }

  if (!correlations) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-card p-4 sm:p-5"
      >
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">Cohort insights</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Computing correlations across <span className="font-mono font-semibold">{patientIds.length}</span> participants…
        </p>
        {loading ? (
          <p className="mt-2 text-xs text-zinc-500">This can take a few seconds depending on CGM size.</p>
        ) : null}
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-card p-4 sm:p-5"
      >
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-50">Cohort insights</h2>

        {cohortMeta ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200/80 bg-white/40 p-3 dark:border-zinc-700 dark:bg-zinc-900/25 md:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cohort summary</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-zinc-200">
                Sample size: <span className="font-mono font-semibold">{cohortMeta.n}</span> participants
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-zinc-200">
                Average age:{' '}
                <span className="font-mono font-semibold">{cohortMeta.avgAge === null ? '—' : cohortMeta.avgAge.toFixed(1)}</span>
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                “Priority pillars” are those with a statistically significant Pearson correlation with CGM spike count (p&lt;0.05).
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            Upload a patient metadata CSV (Age, Sex Assigned, Ethnicity, Health Goal) to see cohort demographics.
          </p>
        )}

        {cohortMeta ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <PieSection title="Gender distribution" data={cohortMeta.genderDist} ariaLabel="Gender" />
            <PieSection title="Ethnicity distribution" data={cohortMeta.ethnicityDist} ariaLabel="Ethnicity" />
            <PieSection title="Health goals" data={cohortMeta.healthGoalDist} ariaLabel="Health goal" />
          </div>
        ) : null}

        {priority.length > 0 ? (
          <div className="mt-3 rounded-xl border border-wellness-500/30 bg-wellness-50/60 p-3 dark:bg-wellness-950/20">
            <p className="text-xs font-bold uppercase tracking-wide text-wellness-700 dark:text-wellness-200">
              Priority pillars
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {priority.map((c) => (
                <span key={c.pillar} className="rounded-lg bg-white/70 px-2 py-1 text-[11px] font-semibold text-slate-800 dark:bg-zinc-900/40 dark:text-zinc-100">
                  {c.pillar} (r={c.r.toFixed(2)}, p={formatP(c.p)})
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-zinc-200/80 bg-white/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/30">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
              Priority pillars
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              No pillars meet p&lt;0.05 given the available cohort size and data completeness.
            </p>
          </div>
        )}
      </motion.div>

      <div className="grid gap-3 md:grid-cols-2">
        {PILLAR_NAMES.map((pillar) => (
          <CorrelationPlot
            key={pillar}
            pillar={pillar}
            color={PILLAR_COLORS[pillar]}
            corr={correlations[pillar]}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * CohortInsightsPanel
 * - Plots each pillar’s gauge mean vs CGM spike count across all participants in the session.
 * - Computes Pearson r and p-values and flags “priority pillars” by p<0.05.
 */
export const CohortInsightsPanel = ({
  datasets,
  patientIds,
}: {
  datasets: UploadedDataset[]
  patientIds: string[]
}) => {
  // Keep a single engine instance; the parent handles the tab mounting.
  return <CohortCorrelationsEngine datasets={datasets} patientIds={patientIds} />
}

